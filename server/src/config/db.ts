import mongoose from 'mongoose';

// Stale indexes removed from schemas that must be dropped from existing collections.
const STALE_INDEXES: Record<string, string[]> = {
  ratings: ['transactionId_1_productId_1'],
};

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
};
