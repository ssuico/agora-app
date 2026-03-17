import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { StoreManagerAssignment } from '../models/StoreManagerAssignment.js';
import { User } from '../models/User.js';
import { UserRole } from '../types/index.js';

const isProd = process.env.NODE_ENV === 'production';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body as {
      name: string;
      email: string;
      password: string;
      role: UserRole;
    };

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    let storeIds: string[] | undefined;
    if (user.role === UserRole.STORE_MANAGER) {
      const assignments = await StoreManagerAssignment.find({ userId: user._id });
      storeIds = assignments.map((a) => a.storeId.toString());
    }

    const jwtOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
    };
    const token = jwt.sign(
      {
        userId: user._id,
        name: user.name,
        role: user.role,
        storeIds,
      },
      process.env.JWT_SECRET!,
      jwtOptions
    );

    res.cookie('agora_token', token, {
      httpOnly: true,
      secure: isProd,
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({ token, role: user.role, name: user.name, storeIds });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('agora_token', { path: '/' });
  res.status(200).json({ message: 'Logged out' });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    let storeIds: string[] | undefined;
    if (user.role === UserRole.STORE_MANAGER) {
      const assignments = await StoreManagerAssignment.find({ userId: user._id });
      storeIds = assignments.map((a) => a.storeId.toString());
    }

    res.json({ ...user.toObject(), storeIds });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, avatar } = req.body as { name?: string; avatar?: string };
    const updates: { name?: string; avatar?: string } = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof avatar === 'string') updates.avatar = avatar.trim();
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    let storeIds: string[] | undefined;
    if (user.role === UserRole.STORE_MANAGER) {
      const assignments = await StoreManagerAssignment.find({ userId: user._id });
      storeIds = assignments.map((a) => a.storeId.toString());
    }
    res.json({ ...user.toObject(), storeIds });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: 'Old password and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
