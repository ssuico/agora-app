export interface TokenPayload {
  userId: string;
  name: string;
  role: string;
  storeIds?: string[];
  exp?: number;
}

export function decodeJWT(token: string): TokenPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const decoded = Buffer.from(part, 'base64url').toString('utf-8');
    return JSON.parse(decoded) as TokenPayload;
  } catch {
    return null;
  }
}
