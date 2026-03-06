import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryReport extends Document {
  storeId: mongoose.Types.ObjectId;
  generatedBy: mongoose.Types.ObjectId;
  reportDate: string;
  fileName: string;
  fileData: Buffer;
  mimeType: string;
  createdAt: Date;
}

const inventoryReportSchema = new Schema<IInventoryReport>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportDate: { type: String, required: true },
    fileName: { type: String, required: true },
    fileData: { type: Buffer, required: true },
    mimeType: { type: String, default: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  },
  { timestamps: true }
);

inventoryReportSchema.index({ storeId: 1, reportDate: 1 }, { unique: true });
inventoryReportSchema.index({ storeId: 1, createdAt: -1 });

export const InventoryReport = mongoose.model<IInventoryReport>(
  'InventoryReport',
  inventoryReportSchema
);
