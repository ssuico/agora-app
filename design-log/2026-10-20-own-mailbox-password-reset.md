# Password reset through the operator's own mailbox

**Date:** 2026-10-20
**Status:** proposed
**Author:** collaborative

## Context

[Email codes](2026-10-01-email-verification-codes.md) send signup and password-reset codes over SMTP. [SendGrid hardening](2026-10-07-sendgrid-email-hardening.md) kept SendGrid as that relay. The SendGrid account is still unusable (IP Access Management and authentication failures), so `EMAIL_VERIFICATION_ENABLED` stays off.

Forgot password is already implemented: the sign-in page links to `/forgot-password`, and the API emails a 6-digit code then sets the new password. While the flag is off, that page tells the person to sign in or ask an admin. Changing a password while signed in (Profile, current password required) does not send mail and is unaffected.

The same flag also turns signup codes back on. Signup should keep creating the account immediately.

## Decision

Stop requiring SendGrid. The mailer already speaks plain SMTP. Password-reset mail is sent from the operator's own mailbox, configured only in `server/.env`:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER` and `SMTP_PASS` (an app password or SMTP password, never committed)
- `SMTP_FROM_ADDRESS` set to that same mailbox, plus `SMTP_FROM_NAME` and `SMTP_REPLY_TO`

Split the switch. `EMAIL_VERIFICATION_ENABLED` keeps controlling signup codes and stays off. A new `PASSWORD_RESET_EMAIL_ENABLED` flag controls only forgot-password. Turn that flag on after `pnpm mail:verify` sends a test message from the mailbox.

Example env files stop naming SendGrid as the required host. They document Gmail (`smtp.gmail.com`, port 587, app password) and Microsoft 365 (`smtp.office365.com`, port 587, SMTP AUTH) as the two common setups, and leave the values blank.

## Alternatives Considered

- Flipping the existing flag and leaving signup codes coupled to it. Rejected because a mailbox problem would block new accounts again, which is why codes were paused.
- A new mail provider (another API key service). Rejected because the request is to send from a mailbox the operator already has.
- Building forgot-password again. Rejected because the pages, routes, and code storage are already in place.

## Consequences

- Delivery depends on that mailbox: Gmail needs an app password, Microsoft 365 needs SMTP AUTH enabled, and the From address must be the authenticated mailbox or an alias the host allows.
- Personal and workspace accounts have daily send limits. That is acceptable for password resets, not for bulk mail.
- Signup stays immediate until `EMAIL_VERIFICATION_ENABLED` is turned on separately.
- Secrets stay in `server/.env`. This entry does not record a password or API key.
