# Walk-in orders record who entered them

**Date:** 2026-10-22
**Status:** accepted
**Author:** collaborative

## Context

Transaction history can show the customer on a walk-in (`customerId` or `walkInCustomerName`). It does not store the store manager or admin who created the order. The activity feed names the customer and expires after 30 days, so it cannot answer who entered an order.

## Decision

New walk-in transactions set `createdBy` to the signed-in staff user. Customer checkouts and pre-orders stay empty. Older walk-ins are not backfilled. The transaction table shows a user icon beside the order status on walk-ins. Hovering it shows the staff name, or "Not recorded" when the field is empty. Later edits keep that name even when the response does not populate `createdBy`.

## Alternatives Considered

Reading the activity feed was rejected because those rows expire and name the customer. Backfilling old orders was rejected because the staff member was never stored.

## Consequences

Orders entered after this change can be checked in the table. Orders already in the database stay unmarked.
