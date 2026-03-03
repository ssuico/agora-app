import { NextFunction, Request, Response } from 'express';
import { UserRole } from '../types/index.js';

export const enforceStoreAccess = (req: Request, res: Response, next: NextFunction): void => {
  const { user } = req;
  const storeId =
    req.params.storeId ||
    (req.query.storeId as string) ||
    (req.body?.storeId as string | undefined);

  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (user.role === UserRole.ADMIN) {
    return next();
  }

  if (!storeId) {
    res.status(400).json({ message: 'storeId is required' });
    return;
  }

  if (user.role === UserRole.STORE_MANAGER) {
    if (!user.storeIds?.includes(storeId)) {
      res.status(403).json({ message: 'Forbidden: you are not assigned to this store' });
      return;
    }
    return next();
  }

  // Customers can access any store (they select via location flow)
  if (user.role === UserRole.CUSTOMER) {
    return next();
  }

  res.status(403).json({ message: 'Forbidden' });
};
