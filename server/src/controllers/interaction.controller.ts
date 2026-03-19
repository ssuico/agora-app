import { Request, Response } from 'express';
import { CustomerInteraction } from '../models/CustomerInteraction.js';
import { UserRole } from '../types/index.js';

export const createInteraction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, type, content, guestName } = req.body as {
      storeId: string;
      type: 'recommendation' | 'question';
      content: string;
      guestName?: string;
    };

    if (!storeId || !type || !content?.trim()) {
      res.status(400).json({ message: 'storeId, type, and content are required' });
      return;
    }

    if (!['recommendation', 'question'].includes(type)) {
      res.status(400).json({ message: 'type must be recommendation or question' });
      return;
    }

    const userId = req.user?.userId ?? null;

    const interaction = await CustomerInteraction.create({
      storeId,
      userId,
      guestName: guestName?.trim() ?? null,
      type,
      content: content.trim(),
      status: 'pending',
    });

    res.status(201).json(interaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getInteractions = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      storeId,
      type,
      status,
      limit = '50',
      page = '1',
    } = req.query as Record<string, string>;

    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const filter: Record<string, unknown> = { storeId };
    if (type) filter.type = type;
    if (status) filter.status = status;

    const lim = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = (parseInt(page, 10) - 1) * lim;

    const [interactions, total] = await Promise.all([
      CustomerInteraction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .populate('userId', 'name')
        .lean(),
      CustomerInteraction.countDocuments(filter),
    ]);

    res.json({ interactions, total, page: parseInt(page, 10), limit: lim });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateInteractionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, response } = req.body as {
      status?: 'pending' | 'responded';
      response?: string;
    };

    const role = req.user?.role;
    if (role !== UserRole.ADMIN && role !== UserRole.STORE_MANAGER) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (typeof response === 'string') update.response = response.trim();

    const interaction = await CustomerInteraction.findByIdAndUpdate(id, update, { new: true }).lean();

    if (!interaction) {
      res.status(404).json({ message: 'Interaction not found' });
      return;
    }

    res.json(interaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
