import { Request, Response } from 'express';
import { Expense } from '../models/Expense.js';

export const getExpenses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.query;
    const filter = storeId ? { storeId } : {};
    const expenses = await Expense.find(filter).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const createExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!expense) {
      res.status(404).json({ message: 'Expense not found' });
      return;
    }
    res.json(expense);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const deleteExpense = async (req: Request, res: Response): Promise<void> => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
