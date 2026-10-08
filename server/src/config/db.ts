import mongoose from 'mongoose';

// Stale indexes removed from schemas that must be dropped from existing collections.
const STALE_INDEXES: Record<string, string[]> = {
  ratings: ['transactionId_1_productId_1'],
  transactionreports: ['storeId_1_transactionDate_1', 'storeId_1_createdAt_-1'],
};

// Reports created before `generatedAt` existed: updatedAt is when they were last written.
/**
 * Staff orders used to be stored as `regular` and customer checkout as `reserved`.
 * Mark customer rows before moving unmarked `regular` rows, so a retry cannot
 * turn those customer orders into walk-ins. The migrations record stops a later
 * start from converting new Regular orders.
 */
async function migrateOrderTypesToWalkIn(): Promise<void> {
  const migrations = mongoose.connection.collection('migrations');
  const key = '2026-10-09-order-type-walk-in';
  const transactions = mongoose.connection.collection('transactions');

  if (await migrations.findOne({ key })) {
    await transactions.updateMany(
      { _orderTypeMigratedFrom: { $exists: true } },
      { $unset: { _orderTypeMigratedFrom: '' } }
    );
    return;
  }

  const customers = await transactions.updateMany(
    { orderType: 'reserved' },
    { $set: { orderType: 'regular', _orderTypeMigratedFrom: 'reserved' } }
  );
  const staff = await transactions.updateMany(
    { orderType: 'regular', _orderTypeMigratedFrom: { $exists: false } },
    { $set: { orderType: 'walk-in' } }
  );
  await migrations.insertOne({ key, appliedAt: new Date() });
  await transactions.updateMany(
    { _orderTypeMigratedFrom: { $exists: true } },
    { $unset: { _orderTypeMigratedFrom: '' } }
  );
  console.log(
    `Order types migrated: ${staff.modifiedCount} staff order(s) to walk-in, ${customers.modifiedCount} customer order(s) to regular`
  );
}

/** Recent Activity stored "Walk-in customer" whenever staff picked a registered customer. */
async function repairActivityActorNames(): Promise<void> {
  const logs = mongoose.connection.collection('activitylogs');
  const transactions = mongoose.connection.collection('transactions');
  const users = mongoose.connection.collection('users');

  const candidates = await logs.find({
    type: { $in: ['reservation_created', 'preorder_placed'] },
    actorName: 'Walk-in customer',
    'metadata.transactionId': { $type: 'string' },
  }).toArray();
  if (candidates.length === 0) return;

  const txIds = candidates
    .map((log) => log.metadata?.transactionId as string)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const txs = await transactions.find({ _id: { $in: txIds } }).toArray();
  const txById = new Map(txs.map((tx) => [String(tx._id), tx]));
  const customerIds = txs.map((tx) => tx.customerId).filter(Boolean);
  const customerDocs = await users.find({ _id: { $in: customerIds } }).project({ name: 1, avatar: 1 }).toArray();
  const customerById = new Map(customerDocs.map((user) => [String(user._id), user]));

  let repaired = 0;
  for (const log of candidates) {
    const tx = txById.get(String(log.metadata?.transactionId));
    if (!tx) continue;
    const customer = tx.customerId ? customerById.get(String(tx.customerId)) : undefined;
    const name = (typeof customer?.name === 'string' && customer.name.trim())
      || (typeof tx.walkInCustomerName === 'string' && tx.walkInCustomerName.trim())
      || '';
    if (!name) continue;
    const message = log.type === 'preorder_placed'
      ? `${name} placed a pre-order`
      : `${name} placed a reservation`;
    await logs.updateOne(
      { _id: log._id },
      { $set: { actorName: name, actorAvatar: customer?.avatar || null, message } },
    );
    repaired += 1;
  }
  if (repaired > 0) console.log(`Activity names repaired: ${repaired}`);
}

async function backfillReportGeneratedAt(): Promise<void> {
  await mongoose.connection
    .collection('transactionreports')
    .updateMany({ generatedAt: { $exists: false } }, [{ $set: { generatedAt: '$updatedAt' } }]);
}

async function dropStaleIndexes(): Promise<void> {
  for (const [collectionName, indexNames] of Object.entries(STALE_INDEXES)) {
    const collection = mongoose.connection.collection(collectionName);
    for (const indexName of indexNames) {
      try {
        await collection.dropIndex(indexName);
        console.log(`Dropped stale index "${indexName}" from "${collectionName}"`);
      } catch {
        // Index doesn't exist — nothing to do
      }
    }
  }
}

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

  await mongoose.connect(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  console.log('MongoDB connected');
  await dropStaleIndexes();
  await migrateOrderTypesToWalkIn();
  await repairActivityActorNames();
  await backfillReportGeneratedAt();
};
