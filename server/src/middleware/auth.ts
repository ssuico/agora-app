import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/index.js';

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  }

  if (!token && req.cookies?.agora_token) {
    token = req.cookies.agora_token;
  }

  if (!token) {
    res.status(401).json({ message: 'Unauthorized: missing token' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized: invalid or expired token' });
  }
};
