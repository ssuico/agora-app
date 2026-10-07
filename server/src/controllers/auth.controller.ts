import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { isEmailVerificationEnabled, signupDomainError } from '../config/authFeatures.js';
import { StoreManagerAssignment } from '../models/StoreManagerAssignment.js';
import { User, type IUser } from '../models/User.js';
import { VerificationCode } from '../models/VerificationCode.js';
import {
  CODE_TTL_MS,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_MS,
  codesMatch,
  generateCode,
  hashCode,
  normalizeCode,
  type CodePurpose,
} from '../services/emailCode.js';
import { isMailConfigured, sendVerificationEmail } from '../services/mailer.js';
import { grantedRoles } from '../services/roles.js';
import { UserRole } from '../types/index.js';

const isProd = process.env.NODE_ENV === 'production';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function assignedStoreIds(user: IUser): Promise<string[]> {
  const assignments = await StoreManagerAssignment.find({ userId: user._id });
  return assignments.map((a) => a.storeId.toString());
}

async function issueSession(user: IUser, requestedRole?: UserRole) {
  const roles = grantedRoles(user);
  const role = requestedRole && roles.includes(requestedRole) ? requestedRole : user.role;

  const storeIds = role === UserRole.STORE_MANAGER ? await assignedStoreIds(user) : undefined;

  const jwtOptions: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as SignOptions['expiresIn'],
  };
  const token = jwt.sign(
    {
      userId: user._id,
      name: user.name,
      role,
      roles,
      storeIds,
      avatar: user.avatar ?? '',
    },
    process.env.JWT_SECRET!,
    jwtOptions
  );

  return { token, role, roles, name: user.name, storeIds };
}

function setAuthCookie(res: Response, token: string) {
  res.cookie('agora_token', token, {
    httpOnly: true,
    secure: isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  });
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body as {
      name: string;
      email: string;
      password: string;
      role: UserRole;
    };

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed, role });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

function readEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function passwordError(password: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters';
  if (password.length > 128) return 'Password must be 128 characters or fewer';
  return null;
}

function cooldownResponse(lastSentAt: Date): { retryAfterSeconds: number } | null {
  const elapsed = Date.now() - lastSentAt.getTime();
  if (elapsed >= RESEND_COOLDOWN_MS) return null;
  return { retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000) };
}

async function saveAndSendCode(input: {
  email: string;
  purpose: CodePurpose;
  signupName?: string;
  signupPasswordHash?: string;
  recipientName?: string;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (!isMailConfigured()) {
    return { ok: false, status: 503, message: 'Email delivery is not configured yet.' };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);
  await VerificationCode.findOneAndUpdate(
    { email: input.email, purpose: input.purpose },
    {
      codeHash: hashCode(input.purpose, input.email, code),
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
      signupName: input.signupName,
      signupPasswordHash: input.signupPasswordHash,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  try {
    await sendVerificationEmail({
      to: input.email,
      code,
      purpose: input.purpose,
      name: input.signupName ?? input.recipientName,
    });
  } catch (err) {
    await VerificationCode.deleteOne({ email: input.email, purpose: input.purpose });
    console.error('Failed to send verification email', err);
    return { ok: false, status: 502, message: 'Could not send the email. Try again.' };
  }

  return { ok: true };
}

// Reserves one guess in a single update so concurrent requests cannot exceed MAX_CODE_ATTEMPTS.
async function claimAttempt(id: unknown): Promise<boolean> {
  const claimed = await VerificationCode.findOneAndUpdate(
    { _id: id, attempts: { $lt: MAX_CODE_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true }
  );
  return claimed !== null;
}

// A code works once: only the request that deletes the record may use it.
async function consumeCode(id: unknown): Promise<boolean> {
  const consumed = await VerificationCode.findOneAndDelete({ _id: id });
  return consumed !== null;
}

function duplicateAccountMessage(): string {
  return isEmailVerificationEnabled()
    ? 'An account with this email already exists. Reset the password instead.'
    : 'An account with this email already exists.';
}

export const getAuthOptions = async (_req: Request, res: Response): Promise<void> => {
  res.json({ emailVerificationEnabled: isEmailVerificationEnabled() });
};

export const signup = async (req: Request, res: Response): Promise<void> => {
  if (isEmailVerificationEnabled()) {
    await sendSignupCode(req, res);
    return;
  }

  try {
    const body = req.body as { name?: unknown; email?: unknown; password?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = readEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const invalid = signupInputError(name, email, password);
    if (invalid) {
      res.status(400).json({ message: invalid });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: duplicateAccountMessage() });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      password: hashed,
      role: UserRole.CUSTOMER,
    });
    const session = await issueSession(user);
    setAuthCookie(res, session.token);
    res.status(201).json(session);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      res.status(409).json({ message: duplicateAccountMessage() });
      return;
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

function signupInputError(name: string, email: string, password: string): string | null {
  if (name.length < 2) return 'Full name is required';
  if (name.length > 100) return 'Full name must be 100 characters or fewer';
  if (!EMAIL_RE.test(email)) return 'A valid email is required';
  const domainMessage = signupDomainError(email);
  if (domainMessage) return domainMessage;
  return passwordError(password);
}

export const sendSignupCode = async (req: Request, res: Response): Promise<void> => {
  if (!isEmailVerificationEnabled()) {
    res.status(403).json({ message: 'Email confirmation is turned off.' });
    return;
  }

  try {
    const body = req.body as { name?: unknown; email?: unknown; password?: unknown };
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = readEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const invalid = signupInputError(name, email, password);
    if (invalid) {
      res.status(400).json({ message: invalid });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({ message: 'Email delivery is not configured yet.' });
      return;
    }

    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: duplicateAccountMessage() });
      return;
    }

    const pending = await VerificationCode.findOne({ email, purpose: 'signup' });
    const cooldown = pending ? cooldownResponse(pending.lastSentAt) : null;
    if (cooldown) {
      res.status(429).json({
        message: `Wait ${cooldown.retryAfterSeconds} seconds before requesting another code.`,
        retryAfterSeconds: cooldown.retryAfterSeconds,
      });
      return;
    }

    const signupPasswordHash = await bcrypt.hash(password, 12);
    const sent = await saveAndSendCode({
      email,
      purpose: 'signup',
      signupName: name,
      signupPasswordHash,
    });
    if (!sent.ok) {
      res.status(sent.status).json({ message: sent.message });
      return;
    }

    res.json({
      verificationRequired: true,
      message: 'We sent a 6-digit code to your email.',
      email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const confirmSignup = async (req: Request, res: Response): Promise<void> => {
  if (!isEmailVerificationEnabled()) {
    res.status(403).json({ message: 'Email confirmation is turned off.' });
    return;
  }

  try {
    const body = req.body as { email?: unknown; code?: unknown };
    const email = readEmail(body.email);
    const code = normalizeCode(body.code);
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      res.status(400).json({ message: 'Enter the 6-digit code from your email.' });
      return;
    }
    const domainMessage = signupDomainError(email);
    if (domainMessage) {
      res.status(400).json({ message: domainMessage });
      return;
    }

    const record = await VerificationCode.findOne({ email, purpose: 'signup' });
    if (!record || record.expiresAt.getTime() < Date.now() || !record.signupName || !record.signupPasswordHash) {
      res.status(400).json({ message: 'That code is incorrect or has expired.' });
      return;
    }
    if (!(await claimAttempt(record._id))) {
      await record.deleteOne();
      res.status(400).json({ message: 'Too many incorrect codes. Request a new one.' });
      return;
    }
    if (!codesMatch(record.codeHash, 'signup', email, code)) {
      res.status(400).json({ message: 'That code is incorrect or has expired.' });
      return;
    }
    if (!(await consumeCode(record._id))) {
      res.status(400).json({ message: 'That code is incorrect or has expired.' });
      return;
    }

    const already = await User.findOne({ email });
    if (already) {
      res.status(409).json({ message: duplicateAccountMessage() });
      return;
    }

    const user = await User.create({
      name: record.signupName,
      email,
      password: record.signupPasswordHash,
      role: UserRole.CUSTOMER,
    });

    const session = await issueSession(user);
    setAuthCookie(res, session.token);
    res.status(201).json(session);
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: number }).code === 11000) {
      res.status(409).json({ message: duplicateAccountMessage() });
      return;
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const sendPasswordResetCode = async (req: Request, res: Response): Promise<void> => {
  if (!isEmailVerificationEnabled()) {
    res.status(403).json({ message: 'Email password reset is turned off.' });
    return;
  }

  try {
    const email = readEmail((req.body as { email?: unknown }).email);
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ message: 'A valid email is required' });
      return;
    }
    if (!isMailConfigured()) {
      res.status(503).json({ message: 'Email delivery is not configured yet.' });
      return;
    }

    const neutral = { message: 'If that email has an account, we sent a 6-digit code to it.', email };

    const user = await User.findOne({ email });
    if (!user) {
      res.json(neutral);
      return;
    }

    const pending = await VerificationCode.findOne({ email, purpose: 'password_reset' });
    const cooldown = pending ? cooldownResponse(pending.lastSentAt) : null;
    if (cooldown) {
      res.json(neutral);
      return;
    }

    const sent = await saveAndSendCode({ email, purpose: 'password_reset', recipientName: user.name });
    if (!sent.ok) {
      res.status(sent.status).json({ message: sent.message });
      return;
    }

    res.json(neutral);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const confirmPasswordReset = async (req: Request, res: Response): Promise<void> => {
  if (!isEmailVerificationEnabled()) {
    res.status(403).json({ message: 'Email password reset is turned off.' });
    return;
  }

  try {
    const body = req.body as { email?: unknown; code?: unknown; newPassword?: unknown };
    const email = readEmail(body.email);
    const code = normalizeCode(body.code);
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
      res.status(400).json({ message: 'Enter the 6-digit code from your email.' });
      return;
    }
    const passwordMessage = passwordError(newPassword);
    if (passwordMessage) {
      res.status(400).json({ message: passwordMessage });
      return;
    }

    const record = await VerificationCode.findOne({ email, purpose: 'password_reset' });
    if (!record || record.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ message: 'That code is incorrect or has expired.' });
      return;
    }
    if (!(await claimAttempt(record._id))) {
      await record.deleteOne();
      res.status(400).json({ message: 'Too many incorrect codes. Request a new one.' });
      return;
    }
    if (!codesMatch(record.codeHash, 'password_reset', email, code)) {
      res.status(400).json({ message: 'That code is incorrect or has expired.' });
      return;
    }
    if (!(await consumeCode(record._id))) {
      res.status(400).json({ message: 'That code is incorrect or has expired.' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: 'That code is incorrect or has expired.' });
      return;
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password updated. Sign in with your new password.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.body as { email?: unknown; password?: unknown };
    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
    const password = typeof raw.password === 'string' ? raw.password : '';

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const session = await issueSession(user);
    setAuthCookie(res, session.token);
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('agora_token', { path: '/' });
  res.status(200).json({ message: 'Logged out' });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const roles = grantedRoles(user);
    const storeIds = roles.includes(UserRole.STORE_MANAGER) ? await assignedStoreIds(user) : undefined;

    res.json({ ...user.toObject(), roles, activeRole: req.user!.role, storeIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const switchRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const requested = (req.body as { role?: unknown })?.role;
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const roles = grantedRoles(user);
    if (typeof requested !== 'string' || !roles.includes(requested as UserRole)) {
      res.status(403).json({ message: 'This account does not have that role' });
      return;
    }
    const session = await issueSession(user, requested as UserRole);
    setAuthCookie(res, session.token);
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, avatar } = req.body as { name?: string; avatar?: string };
    const updates: { name?: string; avatar?: string } = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof avatar === 'string') updates.avatar = avatar.trim();
    const user = await User.findByIdAndUpdate(
      req.user!.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const roles = grantedRoles(user);
    const storeIds = roles.includes(UserRole.STORE_MANAGER) ? await assignedStoreIds(user) : undefined;
    res.json({ ...user.toObject(), roles, activeRole: req.user!.role, storeIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };
    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: 'Old password and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: 'New password must be at least 6 characters' });
      return;
    }
    const user = await User.findById(req.user!.userId);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) {
      res.status(401).json({ message: 'Current password is incorrect' });
      return;
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
