import mongoose, { Document, Schema } from 'mongoose';

export type ProductType = 'regular' | 'preorder';
export type PreOrderStatus = 'pending' | 'ready';

/** Inventory queries use this so pre-order products (and missing legacy fields) stay out of stock math. */
export const REGULAR_PRODUCT_FILTER = { productType: { $ne: 'preorder' } } as const;

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
  productType: ProductType;
  /** When false, customers cannot place new pre-orders for this product. */
  preOrderOpen: boolean;
  preOrderExpectedDate?: Date | null;
  /** Last Eastern instant customers can place this pre-order. Null means no deadline. */
  preOrderClosesAt?: Date | null;
  preOrderStatus: PreOrderStatus;
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
    productType: { type: String, enum: ['regular', 'preorder'], default: 'regular' },
    preOrderOpen: { type: Boolean, default: true },
    preOrderExpectedDate: { type: Date, default: null },
    preOrderClosesAt: { type: Date, default: null },
    preOrderStatus: { type: String, enum: ['pending', 'ready'], default: 'pending' },
  },
  { timestamps: true }
);

productSchema.index({ storeId: 1 });
productSchema.index({ storeId: 1, productType: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
