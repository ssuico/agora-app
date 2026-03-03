import mongoose, { Document, Schema } from 'mongoose';

export interface IExpense extends Document {
  storeId: mongoose.Types.ObjectId;
  category: string;
  amount: number;
  date: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true }
);

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema);
