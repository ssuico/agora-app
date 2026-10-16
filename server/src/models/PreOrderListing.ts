import mongoose, { Document, Schema } from 'mongoose';

export type ListingSource = 'inventory' | 'preorder';

export interface IPreOrderListing extends Document {
  productId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  /** Missing on listings created before inventory periods were stored. Those are pre-order. */
  source?: ListingSource;
  listedAt: Date;
  unlistedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const preOrderListingSchema = new Schema<IPreOrderListing>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    source: { type: String, enum: ['inventory', 'preorder'], default: 'preorder' },
    listedAt: { type: Date, required: true },
    unlistedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

preOrderListingSchema.index({ productId: 1, unlistedAt: 1 });
preOrderListingSchema.index({ storeId: 1, unlistedAt: 1 });

export const PreOrderListing = mongoose.model<IPreOrderListing>('PreOrderListing', preOrderListingSchema);
