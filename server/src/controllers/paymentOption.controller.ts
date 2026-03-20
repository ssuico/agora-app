import { Request, Response } from 'express';
import { PaymentOption } from '../models/PaymentOption.js';

export const getPaymentOptionsByStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const options = await PaymentOption.find({ storeId }).sort({ createdAt: 1 });
    res.json(options);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getActivePaymentOptionsByStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const options = await PaymentOption.find({ storeId, isActive: true }).sort({ createdAt: 1 });
    res.json(options);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const createPaymentOption = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const option = await PaymentOption.create({ ...req.body, storeId });
    res.status(201).json(option);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updatePaymentOption = async (req: Request, res: Response): Promise<void> => {
  try {
    const option = await PaymentOption.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!option) {
      res.status(404).json({ message: 'Payment option not found' });
      return;
    }
    res.json(option);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const deletePaymentOption = async (req: Request, res: Response): Promise<void> => {
  try {
    const option = await PaymentOption.findByIdAndDelete(req.params.id);
    if (!option) {
      res.status(404).json({ message: 'Payment option not found' });
      return;
    }
    res.json({ message: 'Payment option deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
