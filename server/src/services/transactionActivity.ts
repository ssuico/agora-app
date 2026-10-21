import mongoose from 'mongoose';
import {
  TransactionActivity,
  type TransactionActivityAction,
} from '../models/TransactionActivity.js';

export function transactionCustomerLabel(tx: {
  walkInCustomerName?: string | null;
  customerId?: unknown;
}): string {
  const customer = tx.customerId as { name?: string } | null | undefined;
  if (customer && typeof customer === 'object' && customer.name?.trim()) return customer.name.trim();
  const walkIn = tx.walkInCustomerName?.trim();
  return walkIn || 'Walk-in';
}

export function describeItemEdits(changes: Array<{ name: string; from: number; to: number }>): string {
  return changes
    .map((change) => {
      if (change.from === 0) return `Added ${change.name} × ${change.to}`;
      if (change.to === 0) return `Removed ${change.name}`;
      return `${change.name} ${change.from} → ${change.to}`;
    })
    .join(', ');
}

export function describeStatusChange(
  existing: {
    claimStatus?: string | null;
    paymentStatus?: string | null;
    paymentMethod?: string | null;
    amountPaid?: number | null;
  },
  update: Record<string, unknown>
): string | null {
  const parts: string[] = [];
  if (typeof update.claimStatus === 'string' && update.claimStatus !== existing.claimStatus) {
    parts.push(update.claimStatus === 'claimed' ? 'Marked claimed' : 'Reverted to unclaimed');
  }
  if (typeof update.paymentStatus === 'string') {
    const next = update.paymentStatus;
    const method = (typeof update.paymentMethod === 'string' ? update.paymentMethod : existing.paymentMethod) ?? null;
    if (next === 'paid' && existing.paymentStatus !== 'paid') {
      parts.push(method === 'bank_qr' ? 'Confirmed payment by QR' : method === 'cash' ? 'Marked paid in cash' : 'Marked paid');
    } else if (next === 'partial') {
      const amount = typeof update.amountPaid === 'number' ? update.amountPaid : null;
      const changed = existing.paymentStatus !== 'partial' || (amount != null && amount !== existing.amountPaid);
      if (changed) {
        parts.push(amount != null ? `Set partial payment to ${amount.toFixed(2)}` : 'Set partial payment');
      }
    } else if (next === 'unpaid' && method === 'bank_qr' && existing.paymentStatus !== 'paid') {
      parts.push('Recorded a QR payment for review');
    } else if (next === 'unpaid' && existing.paymentStatus !== 'unpaid') {
      parts.push('Reverted to unpaid');
    }
  }
  return parts.length > 0 ? parts.join('. ') : null;
}

/** Writes one audit row. A failure is logged and does not undo the order change. */
export async function recordTransactionActivity(input: {
  storeId: mongoose.Types.ObjectId | string;
  transactionId: mongoose.Types.ObjectId | string;
  customerLabel: string;
  action: TransactionActivityAction;
  summary: string;
  actor?: { userId?: string | null; name?: string | null };
}): Promise<void> {
  try {
    const actorId = input.actor?.userId && mongoose.Types.ObjectId.isValid(input.actor.userId)
      ? input.actor.userId
      : null;
    await TransactionActivity.create({
      storeId: input.storeId,
      transactionId: input.transactionId,
      customerLabel: input.customerLabel || 'Walk-in',
      action: input.action,
      summary: input.summary,
      actorId,
      actorName: input.actor?.name?.trim() || 'Staff',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record transaction activity';
    console.error('[transactionActivity]', message);
  }
}
