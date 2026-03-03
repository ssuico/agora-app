import mongoose, { Document, Schema } from 'mongoose';

export interface IStoreManagerAssignment extends Document {
  userId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
}

const assignmentSchema = new Schema<IStoreManagerAssignment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  },
  { timestamps: true }
);

assignmentSchema.index({ userId: 1, storeId: 1 }, { unique: true });

export const StoreManagerAssignment = mongoose.model<IStoreManagerAssignment>(
  'StoreManagerAssignment',
  assignmentSchema
);
