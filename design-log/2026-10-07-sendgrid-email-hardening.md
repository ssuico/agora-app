# SendGrid email codes: verification and hardening

**Date:** 2026-10-07
**Status:** accepted
**Author:** collaborative

## Context

[Email codes](2026-10-01-email-verification-codes.md) were built on SendGrid's SMTP relay and then [paused](2026-10-01-pause-email-codes.md) because SendGrid rejected the API key. A new key was added to `server/.env`, and the request is to turn the flow back on, prove it works, and confirm the credentials are handled safely.

Findings when the new key was tested:

- SMTP login to `smtp.sendgrid.net:587` fails with `451 Authentication failed`. The same key calling SendGrid's REST API returns `403 The requestor's IP Address is not whitelisted`. The key itself is recognised. The SendGrid account has **IP Access Management** enabled, and it blocks this machine. That is the likely cause of the earlier rejection too.
- `server/.env` has no `EMAIL_VERIFICATION_ENABLED`, so the flag is off.
- On this development machine nodemailer's own DNS resolver ignores `dns.setServers()` and stalls for about a minute, so the first send would hang.
- `.env` is gitignored and no key was ever committed. Variants such as `.env.local` are not ignored.

Review of the flow turned up these weaknesses:

- `POST /forgot-password/code` answers 404 for an unknown email, which lets anyone test which addresses have accounts.
- Wrong-code attempts are counted with a read-then-save, so parallel guesses can exceed the 5-attempt limit.
- Code-sending routes share one 30-requests-per-15-minutes limiter with login. Each request can cost an outgoing email.
- Several auth handlers return the raw error object in 500 responses.
- A bad SMTP login is only discovered when a real user tries to sign up.

## Decision

Keep SendGrid over SMTP (`SMTP_*` variables, API key in `SMTP_PASS`). The SendGrid HTTP API sits behind the same IP allow-list, so switching would not help.

- **Credentials.** Secrets stay only in the git-ignored `server/.env` (or the host's environment variables in production). Ignore `.env.*` except `*.env.example`. Logs and the check script never print the key, only whether it is set.
- **Forgot password** returns the same 200 response whether or not the address has an account, and only sends mail when it does.
- **Attempt counting** is a single atomic update, so concurrent guesses cannot exceed the limit.
- **Code-sending routes** get their own limiter of 10 requests per 15 minutes per IP, on top of the one-minute cooldown per address.
- **Transport.** Require STARTTLS, set connection timeouts, and resolve the SMTP host with the OS resolver.
- **Startup.** When `EMAIL_VERIFICATION_ENABLED=true`, the API verifies the SMTP login at boot and logs the outcome without secrets, so a blocked or revoked key shows up immediately.
- **Check script.** `pnpm mail:verify [address]` in `server/` tests the SMTP login and optionally sends a real test message.
- **Errors.** Auth handlers log the error server-side and return only `Server error`.
- **Flag.** `EMAIL_VERIFICATION_ENABLED` stays off until `pnpm mail:verify` passes. Turning it on while SendGrid refuses mail would make every signup fail with a 502.

## Alternatives Considered

- Switching to `@sendgrid/mail`. Rejected because the HTTP API is blocked by the same IP rule, and it would add a dependency for no gain.
- Disabling IP Access Management on the SendGrid account. Not a code decision. It is the account owner's call and is listed as a follow-up.
- Allowing a self-signed TLS override for local mail sinks. Rejected because an insecure switch in a mailer is more risk than value. Local tests stub the transport instead.

## Consequences

- Email codes cannot be switched on until the SendGrid account allows the API server's outbound IP, or IP Access Management is turned off or reconfigured.
- If the production host has no fixed outbound IP, an IP allow-list will keep failing. Either use a host plan with a static outbound IP or relax the SendGrid rule.
- Password reset no longer tells the user when an email has no account. The sign-in page copy already says a code is sent only when the address has an account.
- Signup still answers 409 for an existing email, as designed in the original entry.
- Sessions already issued stay valid after a password reset. Tokens are stateless JWTs, so revoking them would need a token-version field. That is not part of this change.
