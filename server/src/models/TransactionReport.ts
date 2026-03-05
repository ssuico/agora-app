import mongoose, { Document, Schema } from 'mongoose';

export interface ITransactionReport extends Document {
  storeId: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  transactionDate: string;
  fileName: string;
  fileData: Buffer;
  mimeType: string;
  createdAt: Date;
}

const transactionReportSchema = new Schema<ITransactionReport>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    transactionDate: { type: String, required: true },
    fileName: { type: String, required: true },
    fileData: { type: Buffer, required: true },
    mimeType: { type: String, default: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  },
  { timestamps: true }
);

transactionReportSchema.index({ storeId: 1, transactionDate: 1 }, { unique: true });
transactionReportSchema.index({ storeId: 1, createdAt: -1 });

export const TransactionReport = mongoose.model<ITransactionReport>(
  'TransactionReport',
  transactionReportSchema
);
