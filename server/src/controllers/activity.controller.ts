import { Request, Response } from 'express';
import { ActivityLog } from '../models/ActivityLog.js';

export const getActivityLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, limit = '20' } = req.query as Record<string, string>;

    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const lim = Math.min(parseInt(limit, 10) || 20, 50);

    const logs = await ActivityLog.find({ storeId })
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
