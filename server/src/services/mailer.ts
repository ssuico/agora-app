import nodemailer from 'nodemailer';
import type { CodePurpose } from './emailCode.js';

function smtpPort(): number {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return Number.isFinite(port) ? port : 587;
}

function resolveFrom(): string | undefined {
  const address = process.env.SMTP_FROM_ADDRESS?.trim();
  if (address) {
    const name = process.env.SMTP_FROM_NAME?.trim();
    return name ? `${name} <${address}>` : address;
  }
  const from = process.env.SMTP_FROM?.trim();
  return from || undefined;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && resolveFrom());
}

function createTransport() {
  const port = smtpPort();
  const authUser = process.env.SMTP_USER;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: authUser
      ? {
          user: authUser,
          pass: process.env.SMTP_PASS ?? '',
        }
      : undefined,
  });
}

export async function sendVerificationEmail(input: {
  to: string;
  code: string;
  purpose: CodePurpose;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error('SMTP is not configured');
  }

  const isSignup = input.purpose === 'signup';
  const subject = isSignup ? 'Confirm your Agora account' : 'Reset your Agora password';
  const intro = isSignup
    ? 'Use this code to confirm your email and create your Agora account.'
    : 'Use this code to set a new password for your Agora account.';

  const text = `${intro}\n\n${input.code}\n\nThis code expires in 10 minutes. If you did not request it, you can ignore this email.`;
  const html = `
    <p>${intro}</p>
    <p style="font-size:28px;letter-spacing:0.28em;font-weight:700;margin:24px 0;">${input.code}</p>
    <p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
  `;

  await createTransport().sendMail({
    from: resolveFrom(),
    replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
    to: input.to,
    subject,
    text,
    html,
  });
}
