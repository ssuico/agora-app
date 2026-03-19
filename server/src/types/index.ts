export enum UserRole {
  ADMIN = 'admin',
  STORE_MANAGER = 'store_manager',
  CUSTOMER = 'customer',
}

export interface JwtPayload {
  userId: string;
  name: string;
  role: UserRole;
  storeIds?: string[];
  avatar?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
