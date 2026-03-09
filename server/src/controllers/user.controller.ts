import { Request, Response } from 'express';
import { StoreManagerAssignment } from '../models/StoreManagerAssignment.js';
import { User } from '../models/User.js';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getUserAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const assignments = await StoreManagerAssignment.find({ userId: req.params.id }).populate(
      'storeId',
      'name'
    );
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, role } = req.body;
    const updates: { name?: string; role?: string } = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof role === 'string' && role.trim()) updates.role = role.trim();
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await StoreManagerAssignment.deleteMany({ userId: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
