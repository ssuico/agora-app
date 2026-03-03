import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation extends Document {
  name: string;
}

const locationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
);

export const Location = mongoose.model<ILocation>('Location', locationSchema);
