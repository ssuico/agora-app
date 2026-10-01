import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { StoreManagerAssignment } from '../models/StoreManagerAssignment.js';
import { User } from '../models/User.js';
import { parseRoles } from '../services/roles.js';
import { UserRole } from '../types/index.js';

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role } = req.query;
    const filter = role ? { $or: [{ role }, { roles: role }] } : {};
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
    const { name, role, roles } = req.body;
    const updates: { name?: string; role?: UserRole; roles?: UserRole[] } = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();

    const parsedRoles = roles === undefined ? null : parseRoles(roles);
    if (roles !== undefined && !parsedRoles) {
      res.status(400).json({ message: 'Choose at least one valid role' });
      return;
    }
    const requestedRole = typeof role === 'string' ? (role.trim() as UserRole) : undefined;
    if (requestedRole && !Object.values(UserRole).includes(requestedRole)) {
      res.status(400).json({ message: 'Invalid role' });
      return;
    }

    if (parsedRoles) {
      const primary = requestedRole ?? parsedRoles[0];
      if (!parsedRoles.includes(primary)) {
        res.status(400).json({ message: 'Default view must be one of the selected roles' });
        return;
      }
      updates.role = primary;
      updates.roles = parsedRoles;
    } else if (requestedRole) {
      updates.role = requestedRole;
      updates.roles = [requestedRole];
    }

    if (
      updates.roles &&
      req.user?.userId === req.params.id &&
      !updates.roles.includes(UserRole.ADMIN)
    ) {
      res.status(400).json({ message: 'You cannot remove admin access from your own account' });
      return;
    }

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

export const adminResetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters' });
      return;
    }
    if (newPassword.length > 128) {
      res.status(400).json({ message: 'Password must be 128 characters or fewer' });
      return;
    }
    if (req.user?.userId === req.params.id) {
      res.status(400).json({ message: 'Use your profile page to change your own password' });
      return;
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated' });
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
