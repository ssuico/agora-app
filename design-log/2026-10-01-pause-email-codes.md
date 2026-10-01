# Pause email codes and limit signup domains

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

[Email codes](2026-10-01-email-verification-codes.md) require SendGrid before a customer account is created. SendGrid is rejecting the API key, so new users cannot sign up. Self-signup should work again without sending mail, and only for company addresses.

## Decision

Email codes stay in the API, behind `EMAIL_VERIFICATION_ENABLED`.

- The flag is off unless that variable is exactly `true`. Signup then creates the customer and signs them in immediately.
- Self-signup emails must use `@outdoorequipped.com` or `@channelprecision.com` (subdomains of those are allowed). Other addresses are rejected. Admin User Manager is not limited by this.
- Forgot-password email is hidden and its routes refuse to send while the flag is off.
- Set `EMAIL_VERIFICATION_ENABLED=true` and restart the API to send confirmation and reset codes again. The signup form already switches to the code step when the API asks for one.

## Alternatives Considered

- Deleting the mailer and verification routes. Rejected because SendGrid should be turned back on without rebuilding the flow.
- Allowing any email while SendGrid is down. Rejected because the account should still be limited to company domains.

## Consequences

- Someone with a company email can open a customer account without proving they can read the inbox, until the flag is turned on.
- Existing password reset by email does not run until the flag is on.
