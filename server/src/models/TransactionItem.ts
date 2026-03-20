import mongoose, { Document, Schema } from 'mongoose';

export interface ITransactionItem extends Document {
  transactionId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  quantity: number;
  subtotal: number;
  costSubtotal: number;
}

const transactionItemSchema = new Schema<ITransactionItem>({
  transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
  costSubtotal: { type: Number, required: true },
});

transactionItemSchema.index({ transactionId: 1, productId: 1 });

export const TransactionItem = mongoose.model<ITransactionItem>(
  'TransactionItem',
  transactionItemSchema
);
