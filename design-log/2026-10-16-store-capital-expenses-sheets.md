# Store capital and expenses sheets

**Date:** 2026-10-16
**Status:** accepted
**Author:** collaborative

## Context

Store managers keep a Google Sheet for capital contributions (who put money in, and how much) and a running list of expenses. They want that notebook inside Agora so they do not leave the app. It is a place for notes, not a ledger: the numbers must not change dashboard totals, reports, or the existing `Expense` records that feed `GET /api/reports/summary` (see [admin summary of existing stores](2026-10-01-admin-summary-existing-stores.md)).

## Decision

Add a store-scoped notebook at `/store/:storeId/capital-expenses`, linked from the manager sidebar as "Capital & Expenses".

- New `StoreSheet` collection, separate from `Expense`. Each document is one named sheet: ordered columns (`text` or `number`) and rows of string cells, plus a `version` counter.
- A store can have many sheets. Creating a sheet can start blank (Item, Amount, Notes) or from a template (`capital`: Contributor, Amount, Date, Notes; `expenses`: Item, Amount, Date, Paid by, Notes).
- Number columns are right-aligned, formatted on blur, and show a total row. That total is computed in the browser only. No report query reads `StoreSheet`.
- The grid autosaves the whole sheet (debounced). `PUT` requires the `version` the client last saw. A mismatch returns `409` with the current document so the client reloads instead of overwriting someone else's edit.
- Soft limits: 50 sheets per store, 50 columns, 2000 rows, 500 characters per cell, and about 1.5 MB of grid JSON per sheet.

Access matches payment options: admin and store manager, with `enforceStoreAccess` on store routes and an ownership check (the sheet's `storeId` must be in the manager's `storeIds`) on update and delete.

## Alternatives Considered

- **Reuse the `Expense` model.** Rejected: those rows are summed into financial summaries. A free-form sheet would either pollute totals or need flags on every report query.
- **One grid per store.** Rejected: managers keep capital and expenses as separate tables, the way their Google Sheet is split.
- **A tab on the store dashboard.** Rejected: the grid needs the full page width, and sitting next to Overview would imply it is part of the financial view.
- **Realtime co-editing.** Rejected for this pass: one manager edits at a time in practice, and the version check is enough to avoid silent overwrites.

## Consequences

- Two people editing the same sheet do not see each other's keystrokes. The later save gets `409` and the screen reloads from the server, dropping unsaved local edits.
- Dashboard and report code is unchanged. Deleting a store still does not cascade this data (same as expenses and transactions today).
- CSV import and export are follow-ups.
