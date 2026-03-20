import mongoose, { Document, Schema } from 'mongoose';

export type PaymentOptionType = 'e-wallet' | 'bank';

export interface IPaymentOption extends Document {
  storeId: mongoose.Types.ObjectId;
  type: PaymentOptionType;
  recipientName: string;
  qrImageUrl: string;
  label?: string;
  accountDetails?: string;
  isActive: boolean;
}

const paymentOptionSchema = new Schema<IPaymentOption>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, enum: ['e-wallet', 'bank'], required: true },
    recipientName: { type: String, required: true, trim: true },
    qrImageUrl: { type: String, required: true, trim: true },
    label: { type: String, trim: true },
    accountDetails: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

paymentOptionSchema.index({ storeId: 1, isActive: 1 });

export const PaymentOption = mongoose.model<IPaymentOption>('PaymentOption', paymentOptionSchema);
