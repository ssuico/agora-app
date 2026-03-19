import mongoose, { Document, Schema } from 'mongoose';

export type InteractionType = 'recommendation' | 'question';
export type InteractionStatus = 'pending' | 'responded';

export interface ICustomerInteraction extends Document {
  storeId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId | null;
  guestName?: string | null;
  type: InteractionType;
  content: string;
  status: InteractionStatus;
  response?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const customerInteractionSchema = new Schema<ICustomerInteraction>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    guestName: { type: String, default: null, trim: true },
    type: { type: String, enum: ['recommendation', 'question'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ['pending', 'responded'], default: 'pending' },
    response: { type: String, default: null, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

customerInteractionSchema.index({ storeId: 1, createdAt: -1 });
customerInteractionSchema.index({ storeId: 1, status: 1 });
customerInteractionSchema.index({ storeId: 1, type: 1 });

export const CustomerInteraction = mongoose.model<ICustomerInteraction>(
  'CustomerInteraction',
  customerInteractionSchema
);
