import mongoose, { Document, Schema } from 'mongoose';

export interface IPreOrderListing extends Document {
  productId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  listedAt: Date;
  unlistedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const preOrderListingSchema = new Schema<IPreOrderListing>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    listedAt: { type: Date, required: true },
    unlistedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

preOrderListingSchema.index({ productId: 1, unlistedAt: 1 });
preOrderListingSchema.index({ storeId: 1, unlistedAt: 1 });

export const PreOrderListing = mongoose.model<IPreOrderListing>('PreOrderListing', preOrderListingSchema);
