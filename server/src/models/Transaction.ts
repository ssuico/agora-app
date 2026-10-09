import mongoose, { Document, Schema } from 'mongoose';

export type ClaimStatus = 'unclaimed' | 'claimed';
export type PaymentStatus = 'unpaid' | 'paid' | 'partial';
export type OrderStatus = 'active' | 'cancelled';
export type OrderType = 'regular' | 'walk-in' | 'preorder';
export type PreOrderDisplayStatus = 'pending' | 'ready' | 'fulfilled' | 'cancelled';

export type DisplayOrderStatus = OrderStatus | 'completed';

export type CancellationRequestStatus = 'pending' | 'approved' | 'rejected';

/** A customer's ask to cancel; the order stays active until a store manager approves. */
export interface CancellationRequest {
  status: CancellationRequestStatus;
  reason: string;
  requestedAt: Date;
  resolvedAt?: Date | null;
  /** Optional message from the store manager, e.g. why a request was declined. */
  responseNote?: string | null;
}

/** An order is completed when it is not cancelled and is both paid and claimed. */
export function getDisplayOrderStatus(tx: {
  orderStatus?: OrderStatus | null;
  claimStatus?: ClaimStatus | null;
  paymentStatus?: PaymentStatus | null;
}): DisplayOrderStatus {
  if (tx.orderStatus === 'cancelled') return 'cancelled';
  return tx.claimStatus === 'claimed' && tx.paymentStatus === 'paid' ? 'completed' : 'active';
}

/**
 * Pre-order status is derived, matching getDisplayOrderStatus.
 * Ready comes from the product; fulfilled is paid and claimed; cancelled wins.
 */
export function getPreOrderDisplayStatus(
  tx: {
    orderStatus?: OrderStatus | null;
    claimStatus?: ClaimStatus | null;
    paymentStatus?: PaymentStatus | null;
  },
  product?: { preOrderStatus?: 'pending' | 'ready' | null } | null
): PreOrderDisplayStatus {
  if (tx.orderStatus === 'cancelled') return 'cancelled';
  if (getDisplayOrderStatus(tx) === 'completed') return 'fulfilled';
  if (product?.preOrderStatus === 'ready') return 'ready';
  return 'pending';
}

export interface ITransaction extends Document {
  storeId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  /** Display name when no customerId (walk-in). */
  walkInCustomerName?: string | null;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  claimStatus: ClaimStatus;
  paymentStatus: PaymentStatus;
  /** Amount paid so far; used when paymentStatus === 'partial'. */
  amountPaid: number;
  orderStatus: OrderStatus;
  orderType: OrderType;
  /** When the order became fully paid; null while unpaid or partial. */
  paidAt?: Date | null;
  /** When the order was marked claimed; null while unclaimed. */
  claimedAt?: Date | null;
  /** Optional notes for the transaction (store manager). */
  notes?: string | null;
  /** Optional notes from the customer when placing the reservation. */
  customerNotes?: string | null;
  cancellationRequest?: CancellationRequest | null;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    walkInCustomerName: { type: String, default: null },
    totalAmount: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    grossProfit: { type: Number, required: true },
    claimStatus: { type: String, enum: ['unclaimed', 'claimed'], default: 'unclaimed' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'partial'], default: 'unpaid' },
    amountPaid: { type: Number, default: 0, min: 0 },
    orderStatus: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    orderType: { type: String, enum: ['regular', 'walk-in', 'preorder'], default: 'regular' },
    paidAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
    notes: { type: String, default: null },
    customerNotes: { type: String, default: null },
    cancellationRequest: {
      type: new Schema<CancellationRequest>(
        {
          status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
          reason: { type: String, required: true, trim: true, maxlength: 500 },
          requestedAt: { type: Date, required: true },
          resolvedAt: { type: Date, default: null },
          responseNote: { type: String, default: null, trim: true, maxlength: 500 },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

transactionSchema.index({ storeId: 1, createdAt: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
