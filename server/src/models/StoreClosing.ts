import mongoose, { Document, Schema } from 'mongoose';

interface CarryOverSelection {
  productId: mongoose.Types.ObjectId;
  carryOver: boolean;
  currentStock: number;
}

export interface IStoreClosing extends Document {
  storeId: mongoose.Types.ObjectId;
  date: Date;
  closedBy?: mongoose.Types.ObjectId;
  closedAt: Date;
  /** True when the end-of-day job closed the store with no manager present. */
  autoClosed: boolean;
  carryOverSelections: CarryOverSelection[];
}

const storeClosingSchema = new Schema<IStoreClosing>({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  date: { type: Date, required: true },
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  closedAt: { type: Date, required: true },
  autoClosed: { type: Boolean, default: false },
  carryOverSelections: [
    {
      productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
      carryOver: { type: Boolean, required: true },
      currentStock: { type: Number, required: true, min: 0 },
    },
  ],
});

storeClosingSchema.index({ storeId: 1, date: 1 }, { unique: true });

export const StoreClosing = mongoose.model<IStoreClosing>(
  'StoreClosing',
  storeClosingSchema
);
