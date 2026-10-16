# Automatic end-of-day store close

**Date:** 2026-10-17
**Status:** accepted
**Author:** collaborative

## Context

Closing a store is a manual inventory action. It records a `StoreClosing` for that Eastern calendar day, marks the store closed, and writes the next day's inventory rows from the manager's carry-over choices. Non-perishable items start checked; perishable items start unchecked. Quantity, including zero, does not change that manual choice.

Managers sometimes forget the close. The store then stays open past the end of the day, and leftover non-perishable stock is not placed on the next day's inventory.

## Decision

A scheduler in the API process closes each store for every Eastern calendar day that has already ended and has no `StoreClosing` yet. It runs shortly after the server starts, just after each local midnight (`APP_TIMEZONE`, Eastern), and again hourly so a missed midnight still gets caught. A cursor stores the last date fully processed, so a later restart does not close a day again after a manager reopens it.

Automatic carry-over is narrower than the manual dialog:

- Only products that already have an inventory row for the day being closed are considered.
- A product is carried when it is non-perishable and its remaining inventory quantity is greater than zero.
- Perishable items, and non-perishable items with no remaining stock, are not carried.
- The next day's inventory row is created only when that product does not already have one. An existing row is left as the manager set it.
- The storefront is marked closed only when the new day has no inventory row and no sale yet. If the new day is already in progress, the missed close is still recorded and missing carry-over rows are still created, without shutting a store that is already selling.

The closing is stored with `autoClosed: true` and no `closedBy` user. A manager can still edit or reopen that day from Inventory.

## Alternatives Considered

- **Reuse the manual defaults, including zero-quantity non-perishable items.** The request is to carry items that still have stock.
- **Always set the storefront closed, even during a daytime catch-up.** That would interrupt a store that had already opened for the new day.
- **Overwrite next-day inventory rows on catch-up.** Those rows may already be a new listing or a restock.

## Consequences

- The first run after deploy closes the previous Eastern day for every store that was never closed that day.
- Reopening a day after the job has passed it stays reopened until someone closes it again. The job does not repeat a date it already finished.
- Perishable leftovers stay off the next day's inventory, same as leaving them unchecked in the manual close.
