# Email codes for signup and password reset

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

[Customer self-signup](2026-10-01-customer-self-signup.md) creates a customer account as soon as the form is submitted. Nothing checks that the person can read that inbox. There is also no way to set a new password when an existing account has forgotten it. The logged-in reset still requires the current password.

## Decision

One email-code mechanism covers both cases. Codes are 6 digits, expire after 10 minutes, allow 5 wrong attempts, and a new code cannot be sent to the same address more often than once a minute.

- **New account.** `POST /api/auth/signup/code` stores the name and a password hash, then emails a confirmation code. The user is not created yet. `POST /api/auth/signup/confirm` creates the customer and signs them in only when the code matches. A client-supplied role is still ignored.
- **Forgotten password.** From sign-in, `POST /api/auth/forgot-password/code` emails a code when that address already has an account. `POST /api/auth/forgot-password/confirm` sets the new password after the code matches. This works for any existing role. The person then signs in with the new password.
- If someone tries to sign up with an email that already has an account, they are sent to the password reset flow instead of receiving a second account.
- Admin User Manager registration is unchanged and does not require a code.
- Mail is sent with SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` on the API server).

## Alternatives Considered

- Creating the account immediately and blocking login until the email is confirmed. Rejected because an unconfirmed address would still reserve the account.
- A link instead of a code. Rejected because the request is for a code the person types back into the app.
- Turning an existing-email signup into a silent password change. Rejected because the person may not have meant to replace the password on an account they already have.

## Consequences

- Signup no longer returns a session until the code is confirmed. The earlier decision to sign in immediately is superseded for self-signup only.
- The API server must have SMTP settings or confirmation and reset emails cannot be delivered.
- Codes are stored as an HMAC, not as the digits themselves.
