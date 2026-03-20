import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryRecord extends Document {
  productId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  date: Date;
  initialStock: number;
  restock: number;
  reduction: number;
}

const inventoryRecordSchema = new Schema<IInventoryRecord>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  date: { type: Date, required: true },
  initialStock: { type: Number, default: 0, min: 0 },
  restock: { type: Number, default: 0, min: 0 },
  reduction: { type: Number, default: 0, min: 0 },
});

inventoryRecordSchema.index({ productId: 1, date: 1 }, { unique: true });
inventoryRecordSchema.index({ storeId: 1, date: 1 });

export const InventoryRecord = mongoose.model<IInventoryRecord>(
  'InventoryRecord',
  inventoryRecordSchema
);
