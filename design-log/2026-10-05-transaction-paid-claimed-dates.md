# Transaction paid and claimed dates

**Date:** 2026-10-05
**Status:** accepted
**Author:** collaborative

## Context

Transactions only store `createdAt`/`updatedAt` plus the current `claimStatus` and `paymentStatus`. Staff cannot tell when an order was actually paid or claimed, and the generated Excel report has no such columns. `updatedAt` is not a substitute: it changes on any edit (notes, customer, cancel).

## Decision

- **Model.** Add `paidAt` and `claimedAt` (`Date | null`, default `null`) to `Transaction`.
- **When they are set** (server only, the client never sends dates):
  - `claimedAt` is set when `claimStatus` becomes `claimed` and cleared when it reverts to `unclaimed`.
  - `paidAt` is set when `paymentStatus` becomes `paid` and cleared when it becomes `unpaid` or `partial`. A partial payment is not "date paid"; the order is not settled yet.
  - Re-sending the status the order already has does not overwrite the existing date.
  - Transactions created by staff already claimed and/or paid get the creation time as the date.
- **UI.** In the staff Transactions table, an info icon sits beside the Claiming and Payment badges. Hovering or focusing it shows a tooltip with the date claimed or the date paid. Orders without a date show "Not yet claimed/paid" or "Date not recorded" for legacy rows. Dates are formatted in the same timezone as the rest of the table.
- **Report.** The generated Excel report gets `Date Claimed` and `Date Paid` columns, filled on the first row of each transaction like the other order-level columns, blank when no date exists.

## Alternatives Considered

- **Backfill existing rows from `updatedAt`.** Wrong whenever the order was edited after being paid or claimed, so it would present guesses as facts.
- **Status history array.** More flexible (full audit trail) but heavier than the request needs; two nullable fields answer the question and can later be fed from a history.
- **One combined info icon.** Less clear than one icon per status, where the date sits next to the status it describes.

## Consequences

- Transactions that were already paid or claimed before this change have no date; they show "Date not recorded" and blank report cells. No migration is run.
- Reverting a status discards its date; claiming again records the new date.
- Reports already generated are stored files and are not regenerated; only newly generated reports include the new columns.
