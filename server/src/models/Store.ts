import mongoose, { Document, Schema } from 'mongoose';

export interface IStore extends Document {
  name: string;
  locationId: mongoose.Types.ObjectId;
  isOpen: boolean;
  isMaintenance: boolean;
}

const storeSchema = new Schema<IStore>(
  {
    name: { type: String, required: true, trim: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    isOpen: { type: Boolean, default: true },
    isMaintenance: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Store = mongoose.model<IStore>('Store', storeSchema);
