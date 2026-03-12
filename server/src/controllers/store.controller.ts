import { Request, Response } from 'express';
import { Store } from '../models/Store.js';
import { StoreManagerAssignment } from '../models/StoreManagerAssignment.js';
import { User } from '../models/User.js';
import { getIO } from '../socket.js';
import { UserRole } from '../types/index.js';

export const getStores = async (req: Request, res: Response): Promise<void> => {
  try {
    const { locationId } = req.query;
    const filter = locationId ? { locationId } : {};
    const stores = await Store.find(filter).populate('locationId', 'name').sort({ createdAt: -1 });
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getStoresByLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const stores = await Store.find({ locationId: req.params.locationId })
      .populate('locationId', 'name')
      .sort({ name: 1 });
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await Store.findById(req.params.id).populate('locationId', 'name');
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }
    res.json(store);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const createStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await Store.create(req.body);
    res.status(201).json(store);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await Store.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }
    const body = req.body as { isOpen?: boolean; isMaintenance?: boolean };
    if (typeof body.isOpen === 'boolean' || typeof body.isMaintenance === 'boolean') {
      try {
        const io = getIO();
        if (typeof body.isOpen === 'boolean') {
          io.to(`store:${store._id}`).emit('store:status-changed', {
            storeId: String(store._id),
            isOpen: store.isOpen,
          });
        }
        if (typeof body.isMaintenance === 'boolean') {
          io.to(`store:${store._id}`).emit('store:maintenance-changed', {
            storeId: String(store._id),
            isMaintenance: store.isMaintenance,
          });
        }
      } catch {
        /* socket not required for REST update */
      }
    }
    res.json(store);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const deleteStore = async (req: Request, res: Response): Promise<void> => {
  try {
    await StoreManagerAssignment.deleteMany({ storeId: req.params.id });
    await Store.findByIdAndDelete(req.params.id);
    res.json({ message: 'Store deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const assignManager = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as { userId: string };
    const storeId = req.params.id;

    const user = await User.findById(userId);
    if (!user || user.role !== UserRole.STORE_MANAGER) {
      res.status(400).json({ message: 'User not found or is not a store manager' });
      return;
    }

    const store = await Store.findById(storeId);
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }

    const existing = await StoreManagerAssignment.findOne({ userId, storeId });
    if (existing) {
      res.status(409).json({ message: 'Manager already assigned to this store' });
      return;
    }

    const assignment = await StoreManagerAssignment.create({ userId, storeId });
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const unassignManager = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body as { userId: string };
    const storeId = req.params.id;

    const result = await StoreManagerAssignment.findOneAndDelete({ userId, storeId });
    if (!result) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }
    res.json({ message: 'Manager unassigned from store' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getStoreManagers = async (req: Request, res: Response): Promise<void> => {
  try {
    const assignments = await StoreManagerAssignment.find({ storeId: req.params.id }).populate(
      'userId',
      'name email'
    );
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
