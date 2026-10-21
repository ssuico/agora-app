import mongoose, { Document, Schema } from 'mongoose';

export type TransactionActivityAction =
  | 'created'
  | 'items_edited'
  | 'status_changed'
  | 'customer_changed'
  | 'notes_changed'
  | 'cancelled'
  | 'cancel_declined'
  | 'deleted';

export interface ITransactionActivity extends Document {
  storeId: mongoose.Types.ObjectId;
  transactionId: mongoose.Types.ObjectId;
  customerLabel: string;
  action: TransactionActivityAction;
  summary: string;
  actorId: mongoose.Types.ObjectId | null;
  actorName: string;
  createdAt: Date;
  updatedAt: Date;
}

const transactionActivitySchema = new Schema<ITransactionActivity>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', required: true },
    customerLabel: { type: String, required: true, trim: true },
    action: {
      type: String,
      enum: [
        'created',
        'items_edited',
        'status_changed',
        'customer_changed',
        'notes_changed',
        'cancelled',
        'cancel_declined',
        'deleted',
      ],
      required: true,
    },
    summary: { type: String, required: true, trim: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

transactionActivitySchema.index({ storeId: 1, createdAt: -1 });
transactionActivitySchema.index({ transactionId: 1, createdAt: -1 });

export const TransactionActivity = mongoose.model<ITransactionActivity>(
  'TransactionActivity',
  transactionActivitySchema
);
