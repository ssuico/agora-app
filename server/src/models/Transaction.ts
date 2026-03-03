import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  storeId: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
}

const transactionSchema = new Schema<ITransaction>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    totalAmount: { type: Number, required: true },
    totalCost: { type: Number, required: true },
    grossProfit: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
