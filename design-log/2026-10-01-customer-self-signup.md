# Customer self-signup

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

Accounts are created only by an admin through `POST /api/auth/register`, which is authenticated and role-gated. New shoppers cannot open an account themselves. Login already routes a `customer` to `/select-location`.

## Decision

Add a public signup flow separate from admin registration.

- Page: `/signup`, linked from the sign-in form.
- Inputs: full name, email, password. Account type is shown as Customer and is not editable.
- API: `POST /api/auth/signup` (rate-limited, unauthenticated). The server always stores `role: customer` and ignores any role sent by the client.
- Admin `POST /api/auth/register` stays unchanged so staff accounts are still created only by an admin.
- A successful signup signs the user in with the same session cookie as login and sends them to the customer entry (`/select-location`).

## Alternatives Considered

- Opening the existing register route to the public. Rejected because that route accepts any role and would let a caller create an admin.
- Letting the signup form choose a role, defaulting to customer. Rejected because self-service must not grant staff access.

## Consequences

- Duplicate emails return a conflict. Password rules match the existing reset-password minimum (6 characters).
- Staff and admin accounts remain an admin-only action in User Manager.
