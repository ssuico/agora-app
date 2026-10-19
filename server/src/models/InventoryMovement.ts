import mongoose, { Document, Schema } from 'mongoose';

export type InventoryMovementKind =
  | 'transfer_to_preorder'
  | 'receipt'
  | 'reserve'
  | 'release'
  | 'fulfill';

export type InventoryMode = 'inventory' | 'preorder';

export interface IInventoryMovement extends Document {
  productId: mongoose.Types.ObjectId;
  storeId: mongoose.Types.ObjectId;
  quantity: number;
  kind: InventoryMovementKind;
  sourceMode: InventoryMode;
  destinationMode: InventoryMode;
  userId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const inventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    quantity: { type: Number, required: true, min: 0 },
    kind: {
      type: String,
      enum: ['transfer_to_preorder', 'receipt', 'reserve', 'release', 'fulfill'],
      required: true,
    },
    sourceMode: { type: String, enum: ['inventory', 'preorder'], required: true },
    destinationMode: { type: String, enum: ['inventory', 'preorder'], required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

inventoryMovementSchema.index({ productId: 1, createdAt: -1 });
inventoryMovementSchema.index({ storeId: 1, createdAt: -1 });

export const InventoryMovement = mongoose.model<IInventoryMovement>(
  'InventoryMovement',
  inventoryMovementSchema
);
