# Admin manual password reset

**Date:** 2026-10-02
**Status:** accepted
**Author:** collaborative

## Context

Email password reset is paused behind `EMAIL_VERIFICATION_ENABLED` ([2026-10-01-pause-email-codes.md](./2026-10-01-pause-email-codes.md)), so a user who forgets a password has no way back in. Admins can edit a user's name and role in the User Manager but cannot set a password.

## Decision

Add `POST /api/users/:id/password` on the API, admin only. The body is `{ newPassword }`. It uses the same rules as signup (6 to 128 characters), hashes with bcrypt cost 12, and saves. The response is a message only; the password is never echoed or logged.

The User Manager gets a key icon on each row that opens a "Reset Password" dialog with a new-password field, a show/hide toggle, and a Generate button that fills a random 12 character password. The admin passes the password to the user outside the app.

An admin cannot use this on their own account; the profile page already handles that with the old password.

## Alternatives Considered

- Send a reset link or temporary password by email. Rejected while mail is paused.
- Force a password change at next sign-in. Rejected for now because the user model has no flag for it.
- Reuse `PATCH /api/users/:id`. Rejected so the password path has its own validation and cannot be hit by a plain profile edit.

## Consequences

- Sessions are stateless JWTs, so a user already signed in keeps their session until it expires. Only the next sign-in needs the new password.
- The admin sees the plain password while setting it. Hand it over privately.
