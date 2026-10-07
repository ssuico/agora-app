import 'dotenv/config';

if (process.env.NODE_ENV !== 'production') {
  const dns = await import('node:dns');
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}

const { describeMailConfig, isMailConfigured, sendTestEmail, verifyMailTransport } = await import(
  './services/mailer.js'
);

const to = process.argv[2]?.trim();
const kind = process.argv[3] === 'reset' ? 'password_reset' : 'signup';

console.log('Mail config:', describeMailConfig());

if (!isMailConfigured()) {
  console.error('FAIL: SMTP_HOST, SMTP_USER, SMTP_PASS and a from address are required.');
  process.exit(1);
}

try {
  await verifyMailTransport();
  console.log('OK: connected and authenticated with the SMTP server.');
} catch (err) {
  const e = err as { code?: string; responseCode?: number; response?: string; message?: string };
  console.error('FAIL: SMTP connection or login rejected.', {
    code: e.code,
    responseCode: e.responseCode,
    response: e.response,
    message: e.message,
  });
  process.exit(1);
}

if (to) {
  try {
    await sendTestEmail(to, kind);
    console.log(`OK: ${kind} test email accepted for ${to}.`);
  } catch (err) {
    const e = err as { code?: string; responseCode?: number; response?: string; message?: string };
    console.error('FAIL: SMTP server rejected the test email.', {
      code: e.code,
      responseCode: e.responseCode,
      response: e.response,
      message: e.message,
    });
    process.exit(1);
  }
} else {
  console.log('Pass an address to also send a test email: pnpm mail:verify you@example.com [signup|reset]');
}
