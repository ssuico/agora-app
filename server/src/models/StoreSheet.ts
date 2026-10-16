import mongoose, { Document, Schema } from 'mongoose';

export type SheetColumnType = 'text' | 'number' | 'date' | 'formula';

export interface ISheetColumn {
  id: string;
  label: string;
  type: SheetColumnType;
  formula?: string;
}

export interface ISheetRow {
  id: string;
  cells: Map<string, string>;
}

export interface IStoreSheet extends Document {
  storeId: mongoose.Types.ObjectId;
  name: string;
  order: number;
  columns: ISheetColumn[];
  rows: ISheetRow[];
  version: number;
  updatedBy?: mongoose.Types.ObjectId;
}

const columnSchema = new Schema<ISheetColumn>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['text', 'number', 'date', 'formula'], required: true, default: 'text' },
    formula: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false, id: false }
);

const rowSchema = new Schema<ISheetRow>(
  {
    id: { type: String, required: true },
    cells: { type: Map, of: String, default: () => new Map() },
  },
  { _id: false, id: false }
);

const storeSheetSchema = new Schema<IStoreSheet>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true, default: 0 },
    columns: { type: [columnSchema], required: true },
    rows: { type: [rowSchema], default: [] },
    version: { type: Number, required: true, default: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

storeSheetSchema.index({ storeId: 1, order: 1 });
storeSheetSchema.set('toJSON', { flattenMaps: true });
storeSheetSchema.set('toObject', { flattenMaps: true });

export const StoreSheet = mongoose.model<IStoreSheet>('StoreSheet', storeSheetSchema);
