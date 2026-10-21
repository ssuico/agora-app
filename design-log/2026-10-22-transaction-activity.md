# Transaction activity is a staff audit, separate from the storefront feed

**Date:** 2026-10-22
**Status:** accepted
**Author:** collaborative

## Context

The Transactions page can change claim, payment, items, customer, notes, cancellation, and deletion. The storefront `ActivityLog` names the customer on the order, covers only create and item edits, and expires after 30 days. That feed cannot show which store manager made a later change.

## Decision

New walk-ins and later staff actions write a `TransactionActivity` row that does not expire: store, order, customer label at the time, action, summary, and the staff user's id and name. The Transactions page gains an Activity tab, newest first, with a search that can narrow the list to one order. Rows already in the database are not backfilled. Customer checkout is not a staff action and is not written here. Deleting an order keeps the activity row, including the delete itself.

## Alternatives Considered

- **Reuse ActivityLog.** Rejected. It expires, and its name is the customer, so it is the wrong audit.
- **Store the trail on the transaction document.** Rejected. A deleted order would take the trail with it, and the document would grow with every edit.
- **Only an expander on each order row.** Useful when investigating one order. The tab is the place to scan every manager action across orders. Search on that tab narrows to one order id.

## Consequences

History starts when this is deployed. A logging failure does not undo the order change. The public activity feed is unchanged.
