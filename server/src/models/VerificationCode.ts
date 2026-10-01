import mongoose, { Document, Schema } from 'mongoose';
import type { CodePurpose } from '../services/emailCode.js';

export interface IVerificationCode extends Document {
  email: string;
  purpose: CodePurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
  signupName?: string;
  signupPasswordHash?: string;
}

const verificationCodeSchema = new Schema<IVerificationCode>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    purpose: { type: String, enum: ['signup', 'password_reset'], required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, required: true },
    signupName: { type: String, trim: true },
    signupPasswordHash: { type: String },
  },
  { timestamps: true }
);

verificationCodeSchema.index({ email: 1, purpose: 1 }, { unique: true });
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationCode = mongoose.model<IVerificationCode>(
  'VerificationCode',
  verificationCodeSchema
);
