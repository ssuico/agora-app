import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../types/index.js';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), required: true },
    avatar: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
