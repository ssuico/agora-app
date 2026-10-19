import mongoose from 'mongoose';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { InventoryMovement, type InventoryMode, type InventoryMovementKind } from '../models/InventoryMovement.js';
import { Product } from '../models/Product.js';
import { todayInAppTz } from './storeDayClose.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';

export interface ReconciliationPlan {
  physical: number;
  outstanding: number;
  received: number;
  additionalNeeded: number;
  total: number;
  shortage: number;
  /** Negative when received stock does not cover outstanding pre-orders. */
  available: number;
  reserved: number;
}

export interface PreOrderBreakdown {
  outstanding: number;
  paidOrders: number;
  unpaidOrders: number;
  cancelledOrders: number;
  paidUnits: number;
  unpaidUnits: number;
  cancelledUnits: number;
}

export interface MovementActor {
  userId?: string | null;
}

export function physicalOnHand(product: { stockQuantity?: number | null; reservedQuantity?: number | null }): number {
  return Math.max(0, product.stockQuantity ?? 0) + Math.max(0, product.reservedQuantity ?? 0);
}

/** Units just received are added, then outstanding pre-orders are reserved first. */
export function planReconciliation(physical: number, outstanding: number, received: number): ReconciliationPlan {
  const safePhysical = Math.max(0, physical);
  const safeOutstanding = Math.max(0, outstanding);
  const safeReceived = Math.max(0, received);
  const additionalNeeded = Math.max(0, safeOutstanding - safePhysical);
  const total = safePhysical + safeReceived;
  const shortage = Math.max(0, safeOutstanding - total);
  return {
    physical: safePhysical,
    outstanding: safeOutstanding,
    received: safeReceived,
    additionalNeeded,
    total,
    shortage,
    available: total - safeOutstanding,
    reserved: safeOutstanding,
  };
}

export async function preOrderBreakdown(productId: mongoose.Types.ObjectId): Promise<PreOrderBreakdown> {
  const { demandForProducts } = await import('../controllers/preorder.controller.js');
  const demand = await demandForProducts([productId]);
  const outstanding = demand.get(String(productId))?.totalUnits ?? 0;

  const items = await TransactionItem.find({ productId }).select('transactionId quantity').lean();
  const qtyByTx = new Map<string, number>();
  for (const item of items) {
    const key = String(item.transactionId);
    qtyByTx.set(key, (qtyByTx.get(key) ?? 0) + item.quantity);
  }

  const transactions = qtyByTx.size
    ? await Transaction.find({ _id: { $in: [...qtyByTx.keys()] }, orderType: 'preorder' })
      .select('orderStatus paymentStatus')
      .lean()
    : [];

  const breakdown: PreOrderBreakdown = {
    outstanding,
    paidOrders: 0,
    unpaidOrders: 0,
    cancelledOrders: 0,
    paidUnits: 0,
    unpaidUnits: 0,
    cancelledUnits: 0,
  };

  for (const tx of transactions) {
    const units = qtyByTx.get(String(tx._id)) ?? 0;
    if (tx.orderStatus === 'cancelled') {
      breakdown.cancelledOrders += 1;
      breakdown.cancelledUnits += units;
    } else if (tx.paymentStatus === 'paid') {
      breakdown.paidOrders += 1;
      breakdown.paidUnits += units;
    } else {
      breakdown.unpaidOrders += 1;
      breakdown.unpaidUnits += units;
    }
  }

  return breakdown;
}

export async function recordMovement(
  input: {
    productId: mongoose.Types.ObjectId | string;
    storeId: mongoose.Types.ObjectId | string;
    quantity: number;
    kind: InventoryMovementKind;
    sourceMode: InventoryMode;
    destinationMode: InventoryMode;
    actor?: MovementActor | null;
  },
  session?: mongoose.ClientSession
): Promise<void> {
  if (input.quantity < 0) return;
  if (input.quantity === 0 && input.kind !== 'transfer_to_preorder') return;
  const userId = input.actor?.userId && mongoose.Types.ObjectId.isValid(input.actor.userId)
    ? new mongoose.Types.ObjectId(input.actor.userId)
    : null;
  await InventoryMovement.create([{
    productId: input.productId,
    storeId: input.storeId,
    quantity: input.quantity,
    kind: input.kind,
    sourceMode: input.sourceMode,
    destinationMode: input.destinationMode,
    userId,
  }], session ? { session } : undefined);
}

type ReservationLine = { productId: mongoose.Types.ObjectId; quantity: number };

/**
 * `release` returns outstanding units to the shelf.
 * `fulfill` drops the reservation when the order is handed over and leaves shelf stock alone.
 * `restore` puts a fulfilled order's units back into the reservation, not onto the shelf.
 */
export async function adjustReservedLines(
  lines: ReservationLine[],
  mode: 'release' | 'fulfill' | 'restore',
  session: mongoose.ClientSession,
  actor?: MovementActor | null
): Promise<boolean> {
  const grouped = new Map<string, ReservationLine>();
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const key = String(line.productId);
    const existing = grouped.get(key);
    if (existing) existing.quantity += line.quantity;
    else grouped.set(key, { productId: line.productId, quantity: line.quantity });
  }

  let changed = false;
  for (const line of grouped.values()) {
    const product = await Product.findById(line.productId).session(session);
    if (!product) continue;
    const reserved = product.reservedQuantity ?? 0;

    if (mode === 'restore') {
      if (product.productType !== 'regular') continue;
      product.reservedQuantity = reserved + line.quantity;
      await product.save({ session });
      await recordMovement({
        productId: product._id,
        storeId: product.storeId,
        quantity: line.quantity,
        kind: 'reserve',
        sourceMode: 'preorder',
        destinationMode: 'inventory',
        actor,
      }, session);
      changed = true;
      continue;
    }

    if (reserved <= 0) continue;
    const amount = Math.min(line.quantity, reserved);
    product.reservedQuantity = reserved - amount;
    if (mode === 'release') {
      product.stockQuantity += amount;
      await InventoryRecord.updateOne(
        { productId: product._id, date: todayInAppTz() },
        { $inc: { restock: amount } },
        { session }
      );
    }
    await product.save({ session });
    await recordMovement({
      productId: product._id,
      storeId: product.storeId,
      quantity: amount,
      kind: mode === 'release' ? 'release' : 'fulfill',
      sourceMode: 'preorder',
      destinationMode: mode === 'release' ? 'inventory' : 'preorder',
      actor,
    }, session);
    changed = true;
  }

  return changed;
}
