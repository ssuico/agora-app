# Transaction reports: one per user, store and day

**Date:** 2026-10-06
**Status:** accepted
**Author:** collaborative

## Context

Generate Report on the Transactions page had four symptoms: only one report seemed to exist, one manager overwrote another's report, the "generated" time was wrong, and a user could regenerate the same day's report with no warning.

Causes found in the code:

- `TransactionReport` had a unique index on `{ storeId, transactionDate }` and `generateReport` upserted on the same filter. Every user of a store therefore shared one document per day, and the last writer replaced `generatedBy` and `fileData`.
- The Report History table shows `createdAt`. An upsert that updates an existing document never changes `createdAt`, so a regenerated report kept its first-ever timestamp.
- The file name (`transactions_<date>.xlsx`) was identical for every user. Reports are stored in MongoDB (`fileData`), not on disk, so the name was not an overwrite cause, but downloads from different users were indistinguishable.
- `POST /generate` had no store-access check, so a manager could generate for a store they are not assigned to.

## Decision

- **Uniqueness.** The unique key is `{ generatedBy, storeId, transactionDate }`, enforced by a MongoDB unique index. `transactionDate` is the report's own date key (`YYYY-MM-DD`, or `from_to_to` for a range), which for the default report is today in `APP_TIMEZONE`. Different users, stores or days get separate documents. The old `{ storeId, transactionDate }` index is dropped at startup (`STALE_INDEXES` in `config/db.ts`).
- **Identity.** `generatedBy` always comes from the authenticated JWT (`req.user.userId`). The request carries no user id.
- **Timestamp.** New field `generatedAt`, set to `new Date()` on every create and every update. The UI shows `generatedAt` formatted in the app timezone, never `createdAt`. Existing documents are backfilled once with `generatedAt = updatedAt`, which is the time they were last (over)written.
- **Confirmation flow.** `POST /api/transaction-reports/generate` without `overwrite=true` never replaces anything: if the caller already has a report for that store and date it responds `409 { code: 'REPORT_EXISTS', report }`. The UI shows a confirmation dialog; "Update Report" re-sends the request with `overwrite=true`, "Keep Existing" sends nothing.
- **Concurrency.** The non-overwrite path uses `create`, so two simultaneous requests race on the unique index and the loser gets the same 409. The overwrite path uses an atomic `findOneAndUpdate` upsert and retries once on a duplicate-key error (the documented upsert race).
- **File name.** Includes a slug of the generating user's name: `transactions_<date>_<user>.xlsx`.
- **Access.** `enforceStoreAccess` is added to `POST /generate` and `GET /` so managers can only use stores they are assigned to.

## Alternatives Considered

- **Frontend-only check.** Does not stop races or other clients; the unique index is the real guarantee.
- **Key on generation day instead of report date.** Would make a user's reports for different report dates collide when generated on the same day.
- **Separate "today's report" panel with View/Update buttons.** Needs an extra fetch and can show stale state; the 409 response is always correct. The existing button plus confirmation dialog was chosen.
- **Per-user storage paths.** Not applicable, files live in MongoDB.

## Consequences

- Report History lists every user's reports for the store (unchanged behaviour); each row is now its own user's report.
- Download and delete are still by id with role checks only, not per-owner. Left as is to avoid scope creep.
- The app timezone remains `APP_TIMEZONE` on the server (`America/New_York` in `.env`) and `America/New_York` hard-coded in the client, as elsewhere in the app. A viewer in another timezone sees app time, not their device time.
