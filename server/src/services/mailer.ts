import { lookup } from 'node:dns/promises';
import { readFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import nodemailer from 'nodemailer';
import type { CodePurpose } from './emailCode.js';
import { LOGO_CID, renderCodeEmail } from './emailTemplates.js';

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

// Nodemailer resolves hosts with its own dns.Resolver, which ignores dns.setServers() and can stall
// for a minute on networks with a broken resolver. dns.lookup uses the OS resolver and is reliable.
async function resolveSmtpHost(host: string): Promise<string> {
  if (isIP(host)) return host;
  try {
    const result = await Promise.race([
      lookup(host, { family: 4 }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS lookup timed out')), 5_000)),
    ]);
    return result.address;
  } catch {
    return host;
  }
}

async function createTransport() {
  const port = smtpPort();
  const authUser = process.env.SMTP_USER;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const hostname = process.env.SMTP_HOST ?? '';
  return nodemailer.createTransport({
    host: await resolveSmtpHost(hostname),
    port,
    tls: { servername: hostname },
    secure,
    requireTLS: !secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: authUser
      ? {
          user: authUser,
          pass: process.env.SMTP_PASS ?? '',
        }
      : undefined,
  });
}

export function describeMailConfig(): Record<string, string | number | boolean> {
  return {
    host: process.env.SMTP_HOST ?? '(unset)',
    port: smtpPort(),
    user: process.env.SMTP_USER ?? '(unset)',
    passSet: Boolean(process.env.SMTP_PASS),
    from: resolveFrom() ?? '(unset)',
    replyTo: process.env.SMTP_REPLY_TO?.trim() || '(unset)',
  };
}

export async function verifyMailTransport(): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error('SMTP is not configured');
  }
  await (await createTransport()).verify();
}

// The official logo (same artwork as public/logo.svg). Email clients cannot render SVG, so the PNG
// export is attached inline. This path is the same depth from both src/ and dist/.
const LOGO_URL = new URL('../../../public/apple-touch-icon.png', import.meta.url);
let logoCache: Buffer | null | undefined;

async function loadLogo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await readFile(LOGO_URL);
  } catch {
    console.warn('Agora logo not found for emails; sending without it.');
    logoCache = null;
  }
  return logoCache;
}

async function sendCodeEmail(input: {
  to: string;
  code: string;
  purpose: CodePurpose;
  name?: string;
  subjectPrefix?: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    throw new Error('SMTP is not configured');
  }

  const logo = await loadLogo();
  const { subject, text, html } = renderCodeEmail({
    purpose: input.purpose,
    code: input.code,
    name: input.name,
    hasLogo: logo !== null,
  });

  await (await createTransport()).sendMail({
    from: resolveFrom(),
    replyTo: process.env.SMTP_REPLY_TO?.trim() || undefined,
    to: input.to,
    subject: `${input.subjectPrefix ?? ''}${subject}`,
    text,
    html,
    attachments: logo
      ? [
          {
            filename: 'agora-logo.png',
            content: logo,
            contentType: 'image/png',
            cid: LOGO_CID,
            contentDisposition: 'inline',
          },
        ]
      : undefined,
  });
}

export async function sendTestEmail(to: string, purpose: CodePurpose = 'signup'): Promise<void> {
  await sendCodeEmail({ to, code: '123456', purpose, name: 'Test User', subjectPrefix: '[Test] ' });
}

export async function sendVerificationEmail(input: {
  to: string;
  code: string;
  purpose: CodePurpose;
  name?: string;
}): Promise<void> {
  await sendCodeEmail(input);
}
