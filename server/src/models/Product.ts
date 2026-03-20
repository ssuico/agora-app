import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  storeId: mongoose.Types.ObjectId;
  name: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  discountPrice?: number | null;
  stockQuantity: number;
  isPerishable: boolean;
  sellerName: string;
  notes: string;
}

const productSchema = new Schema<IProduct>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    discountPrice: {
      type: Number,
      default: null,
      min: 0,
      validate: {
        validator(this: IProduct & { get?: (path: string) => unknown }, value: number | null) {
          if (value == null) return true;
          const fromDoc =
            typeof this.sellingPrice === 'number' && Number.isFinite(this.sellingPrice)
              ? this.sellingPrice
              : undefined;
          const fromQueryRaw = typeof this.get === 'function' ? this.get('sellingPrice') : undefined;
          const fromQuery =
            typeof fromQueryRaw === 'number' && Number.isFinite(fromQueryRaw)
              ? fromQueryRaw
              : undefined;
          const sellingPrice = fromDoc ?? fromQuery;
          if (sellingPrice === undefined) return true;
          return value <= sellingPrice;
        },
        message: 'Discount price cannot be greater than selling price',
      },
    },
    stockQuantity: { type: Number, required: true, default: 0, min: 0 },
    isPerishable: { type: Boolean, default: false },
    sellerName: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

productSchema.index({ storeId: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
