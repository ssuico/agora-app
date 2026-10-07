import { CODE_TTL_MS, type CodePurpose } from './emailCode.js';

export const LOGO_CID = 'agora-logo@agora-pos';

const BRAND_RED = '#de283b';
const BRAND_TEAL = '#005461';
const TEXT_STRONG = '#1a1a1a';
const TEXT_BODY = '#404040';
const TEXT_MUTED = '#6b6b6b';
const SURFACE = '#f5f5f5';
const BORDER = '#e3e3e3';
const FONT_STACK = "-apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO_STACK = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

export interface CodeEmailInput {
  purpose: CodePurpose;
  code: string;
  name?: string;
  hasLogo: boolean;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

const COPY = {
  signup: {
    subject: 'Confirm your Agora account',
    preheader: 'Use this code to confirm your email and finish creating your account.',
    title: 'Confirm your email',
    intro: 'Thanks for signing up for Agora. Enter this code in the app to confirm your email and finish creating your account.',
    ignore:
      'If you did not try to create an Agora account, you can ignore this email. No account will be created without this code.',
  },
  password_reset: {
    subject: 'Reset your Agora password',
    preheader: 'Use this code to set a new password for your account.',
    title: 'Reset your password',
    intro: 'We received a request to reset the password for your Agora account. Enter this code in the app to choose a new password.',
    ignore:
      'If you did not ask to reset your password, you can ignore this email. Your password has not been changed.',
  },
} as const satisfies Record<CodePurpose, Record<string, string>>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name: string | undefined): string {
  const first = name?.trim().split(/\s+/)[0] ?? '';
  return first.slice(0, 40);
}

export function renderCodeEmail(input: CodeEmailInput): RenderedEmail {
  const copy = COPY[input.purpose];
  const minutes = Math.round(CODE_TTL_MS / 60_000);
  const greetingName = firstName(input.name);
  const greeting = greetingName ? `Hi ${greetingName},` : 'Hello,';
  const expiry = `This code expires in ${minutes} minutes and can be used once.`;
  const safety = 'For your security, never share this code. Agora staff will never ask you for it.';

  const text = [
    'AGORA',
    'Shop - Reserve - Claim',
    '',
    copy.title.toUpperCase(),
    '',
    greeting,
    '',
    copy.intro,
    '',
    `Your code: ${input.code}`,
    '',
    expiry,
    '',
    safety,
    copy.ignore,
    '',
    '--',
    'Agora POS. This is an automated message.',
  ].join('\n');

  const logo = input.hasLogo
    ? `<img src="cid:${LOGO_CID}" width="56" height="56" alt="Agora" style="display:block;border:0;outline:none;text-decoration:none;border-radius:12px;" />`
    : `<div style="width:56px;height:56px;line-height:56px;border-radius:12px;background:${BRAND_RED};color:#ffffff;font-size:28px;font-weight:700;text-align:center;font-family:${FONT_STACK};">A</div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${SURFACE};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(copy.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SURFACE};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <tr>
            <td style="height:6px;line-height:6px;font-size:0;background:${BRAND_RED};">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right:14px;">${logo}</td>
                  <td valign="middle" style="font-family:${FONT_STACK};">
                    <div style="font-size:26px;line-height:30px;font-weight:700;letter-spacing:-0.01em;color:${BRAND_RED};">Agora</div>
                    <div style="font-size:12px;line-height:18px;letter-spacing:0.08em;text-transform:uppercase;color:${TEXT_MUTED};">Shop &middot; Reserve &middot; Claim</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 0 32px;font-family:${FONT_STACK};">
              <h1 style="margin:0 0 16px 0;font-size:24px;line-height:32px;font-weight:700;color:${TEXT_STRONG};">${escapeHtml(copy.title)}</h1>
              <p style="margin:0 0 12px 0;font-size:16px;line-height:24px;color:${TEXT_STRONG};">${escapeHtml(greeting)}</p>
              <p style="margin:0;font-size:16px;line-height:24px;color:${TEXT_BODY};">${escapeHtml(copy.intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;">
                <tr>
                  <td align="center" style="padding:20px 16px 8px 16px;font-family:${FONT_STACK};font-size:12px;line-height:16px;letter-spacing:0.12em;text-transform:uppercase;color:${TEXT_MUTED};">Your verification code</td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 16px 20px 16px;font-family:${MONO_STACK};font-size:36px;line-height:44px;font-weight:700;letter-spacing:0.32em;color:${BRAND_TEAL};">${escapeHtml(input.code)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0 32px;font-family:${FONT_STACK};font-size:14px;line-height:22px;color:${TEXT_BODY};">${escapeHtml(expiry)}</td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="width:4px;background:${BRAND_TEAL};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:2px 0 2px 14px;font-family:${FONT_STACK};font-size:14px;line-height:22px;color:${TEXT_BODY};">
                    <strong style="color:${TEXT_STRONG};">${escapeHtml(safety)}</strong><br />
                    ${escapeHtml(copy.ignore)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="border-top:1px solid ${BORDER};padding-top:16px;font-family:${FONT_STACK};font-size:12px;line-height:18px;color:${TEXT_MUTED};">
                    Agora POS &middot; This is an automated message, please do not forward it.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: copy.subject, text, html };
}
