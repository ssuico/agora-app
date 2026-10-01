import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../types/index.js';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  roles?: UserRole[];
  avatar?: string;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: Object.values(UserRole), required: true },
    roles: { type: [{ type: String, enum: Object.values(UserRole) }], default: undefined },
    avatar: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

userSchema.pre('validate', function (next) {
  if (this.role && !this.roles?.includes(this.role)) {
    this.roles = [this.role, ...(this.roles ?? [])];
  }
  next();
});

export const User = mongoose.model<IUser>('User', userSchema);
