# Sign-in sessions last one day

**Date:** 2026-10-14
**Status:** accepted
**Author:** collaborative

## Context

The sign-in token (JWT) defaulted to 7 days and was configurable through `JWT_EXPIRES_IN`. The auth cookie lifetime was a separate hard-coded 7 days, repeated in the API server and in four Astro proxy routes (login, signup, signup confirm and switch role). The two values could disagree, and a stale `JWT_EXPIRES_IN` in a deployment would silently keep sessions longer than intended.

## Decision

A session lasts exactly one day.

- `server/src/config/session.ts` exports `SESSION_TTL_SECONDS` (86,400). The token lifetime and the cookie `maxAge` both use it.
- `JWT_EXPIRES_IN` is no longer read. The line was removed from the local `server/.env`.
- The four Astro proxy cookies use a one-day `maxAge` to match.

## Alternatives Considered

- Keeping `JWT_EXPIRES_IN` and changing its default to `1d`. Rejected because a deployment that still sets `7d` would keep seven-day sessions.
- Sliding sessions that renew on activity. Not requested, and it needs a refresh mechanism.

## Consequences

- People have to sign in again after a day, including long-running tablets and shared devices.
- Tokens issued before this change stay valid until their own expiry, up to 7 days. To end them sooner, change `JWT_SECRET`, which signs everyone out. It also invalidates any email codes still pending.
- `JWT_EXPIRES_IN` can be deleted from any deployment's environment variables.
