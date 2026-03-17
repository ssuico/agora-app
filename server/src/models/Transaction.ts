import mongoose, { Document, Schema } from 'mongoose';

export type ClaimStatus = 'unclaimed' | 'claimed';
export type PaymentStatus = 'unpaid' | 'paid' | 'partial';
export type OrderStatus = 'active' | 'cancelled';

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
  /** Optional notes for the transaction (store manager). */
  notes?: string | null;
  /** Optional notes from the customer when placing the reservation. */
  customerNotes?: string | null;
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
    notes: { type: String, default: null },
    customerNotes: { type: String, default: null },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
