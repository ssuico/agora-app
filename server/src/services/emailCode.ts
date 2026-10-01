import crypto from 'node:crypto';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export type CodePurpose = 'signup' | 'password_reset';

export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashCode(purpose: CodePurpose, email: string, code: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not defined');
  return crypto.createHmac('sha256', secret).update(`${purpose}:${email}:${code}`).digest('hex');
}

export function codesMatch(storedHash: string, purpose: CodePurpose, email: string, code: string): boolean {
  const actual = Buffer.from(hashCode(purpose, email, code), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  if (actual.length === 0 || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function normalizeCode(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s/g, '') : '';
}
