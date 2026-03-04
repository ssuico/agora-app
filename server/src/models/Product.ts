import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  storeId: mongoose.Types.ObjectId;
  name: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  isPerishable: boolean;
}

const productSchema = new Schema<IProduct>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stockQuantity: { type: Number, required: true, default: 0, min: 0 },
    isPerishable: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Product = mongoose.model<IProduct>('Product', productSchema);
