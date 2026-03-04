import mongoose, { Document, Schema } from 'mongoose';

export type ClaimStatus = 'unclaimed' | 'claimed';
export type PaymentStatus = 'unpaid' | 'paid';
export type OrderStatus = 'active' | 'cancelled';

export interface ITransaction extends Document {
  storeId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  claimStatus: ClaimStatus;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    totalAmount: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    grossProfit: { type: Number, required: true },
    claimStatus: { type: String, enum: ['unclaimed', 'claimed'], default: 'unclaimed' },
    paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    orderStatus: { type: String, enum: ['active', 'cancelled'], default: 'active' },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
