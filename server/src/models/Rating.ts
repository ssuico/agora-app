import mongoose, { Document, Schema } from 'mongoose';

export type RatingType = 'product' | 'store';

export interface IRating extends Document {
  storeId: mongoose.Types.ObjectId;
  productId?: mongoose.Types.ObjectId | null;
  transactionId?: mongoose.Types.ObjectId | null;
  customerId: mongoose.Types.ObjectId;
  stars: number;
  comment?: string | null;
  type: RatingType;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema<IRating>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction', default: null },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stars: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: null, maxlength: 500, trim: true },
    type: { type: String, enum: ['product', 'store'], required: true },
  },
  { timestamps: true }
);

// One product rating per customer per product (globally, not per transaction)
ratingSchema.index(
  { productId: 1, customerId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { type: 'product', productId: { $ne: null } } }
);
// One standalone store rating per customer per store
ratingSchema.index(
  { storeId: 1, customerId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { type: 'store', transactionId: null } }
);
ratingSchema.index({ storeId: 1, createdAt: -1 });
ratingSchema.index({ productId: 1, storeId: 1 });

export const Rating = mongoose.model<IRating>('Rating', ratingSchema);
