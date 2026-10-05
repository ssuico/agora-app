import { Request, Response } from 'express';
import { Store } from '../models/Store.js';
import { StoreManagerAssignment } from '../models/StoreManagerAssignment.js';
import { User } from '../models/User.js';
import { grantedRoles } from '../services/roles.js';
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
    const { bannerImage: _banner, bannerUpdatedAt: _bannerAt, ...fields } = req.body as Record<string, unknown>;
    const store = await Store.create(fields);
    res.status(201).json(store);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bannerImage: _banner, bannerUpdatedAt: _bannerAt, ...fields } = req.body as Record<string, unknown>;
    const store = await Store.findByIdAndUpdate(req.params.id, fields, {
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

export const updateStoreStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as { isOpen?: boolean; isMaintenance?: boolean };
    const allowed: { isOpen?: boolean; isMaintenance?: boolean } = {};
    if (typeof body.isOpen === 'boolean') allowed.isOpen = body.isOpen;
    if (typeof body.isMaintenance === 'boolean') allowed.isMaintenance = body.isMaintenance;

    if (Object.keys(allowed).length === 0) {
      res.status(400).json({ message: 'Provide isOpen or isMaintenance to update' });
      return;
    }

    const store = await Store.findByIdAndUpdate(req.params.id, allowed, {
      new: true,
      runValidators: true,
    });
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }

    try {
      const io = getIO();
      if (typeof allowed.isOpen === 'boolean') {
        io.to(`store:${store._id}`).emit('store:status-changed', {
          storeId: String(store._id),
          isOpen: store.isOpen,
        });
      }
      if (typeof allowed.isMaintenance === 'boolean') {
        io.to(`store:${store._id}`).emit('store:maintenance-changed', {
          storeId: String(store._id),
          isMaintenance: store.isMaintenance,
        });
      }
    } catch {
      /* socket not required */
    }

    res.json(store);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

const BANNER_MAX_CHARS = 700_000;
const BANNER_DATA_URL_HEAD = /^data:(image\/(?:jpeg|png|webp));base64,$/;

const hasImageMagic = (mime: string, bytes: Buffer): boolean => {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (mime === 'image/png') return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
};

const decodeBanner = (dataUrl: string): { mime: string; bytes: Buffer } | null => {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return null;
  const head = BANNER_DATA_URL_HEAD.exec(dataUrl.slice(0, comma + 1));
  if (!head) return null;
  const bytes = Buffer.from(dataUrl.slice(comma + 1), 'base64');
  if (bytes.length === 0 || !hasImageMagic(head[1], bytes)) return null;
  return { mime: head[1], bytes };
};

export const getStoreBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const store = await Store.findById(req.params.id).select('+bannerImage');
    const banner = store?.bannerImage ? decodeBanner(store.bannerImage) : null;
    if (!banner) {
      res.status(404).json({ message: 'No banner for this store' });
      return;
    }
    res.set({
      'Content-Type': banner.mime,
      'Content-Length': String(banner.bytes.length),
      'Cache-Control': 'private, max-age=86400',
    });
    res.send(banner.bytes);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const setStoreBanner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bannerImage } = req.body as { bannerImage?: string | null };

    if (bannerImage === null) {
      const store = await Store.findByIdAndUpdate(
        req.params.id,
        { $unset: { bannerImage: 1 }, bannerUpdatedAt: null },
        { new: true }
      );
      if (!store) {
        res.status(404).json({ message: 'Store not found' });
        return;
      }
      res.json({ bannerUpdatedAt: null });
      return;
    }

    if (typeof bannerImage !== 'string' || !bannerImage) {
      res.status(400).json({ message: 'Provide bannerImage as an image data URL, or null to remove it' });
      return;
    }
    if (bannerImage.length > BANNER_MAX_CHARS) {
      res.status(413).json({ message: 'Banner image is too large. Choose a smaller image.' });
      return;
    }
    if (!decodeBanner(bannerImage)) {
      res.status(400).json({ message: 'Banner must be a JPEG, PNG or WebP image.' });
      return;
    }

    const store = await Store.findByIdAndUpdate(
      req.params.id,
      { bannerImage, bannerUpdatedAt: new Date() },
      { new: true }
    );
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      return;
    }
    res.json({ bannerUpdatedAt: store.bannerUpdatedAt });
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
    if (!user || !grantedRoles(user).includes(UserRole.STORE_MANAGER)) {
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
