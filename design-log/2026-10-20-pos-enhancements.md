# POS counter enhancements

**Date:** 2026-10-20
**Status:** accepted
**Author:** collaborative

## Context

Walk-in selling still uses the staff Transactions page and the Realtime Stocks tab. Orders cannot change their lines after creation. Payment is only unpaid, partial, or paid, with no cash versus bank/QR record. Hybrid accounts already switch view from the top bar ([2026-10-02-hybrid-roles-and-view-switch.md](./2026-10-02-hybrid-roles-and-view-switch.md)) but login always opens the default role.

## Decision

**Realtime Stocks.** Full screen is a display mode on the existing Realtime Stocks panel. It keeps the Socket.IO `stock:updated` listener and the 5-second poll. Escape or an Exit button leaves it. No new public route.

**Edit lines.** Staff `PATCH /api/transactions/:id/items` replaces the lines inside one Mongo session. Stock changes are the difference from the saved quantities, not a second full deduction. A larger quantity requires that much stock still available. A smaller quantity returns the difference. Removing a line returns its quantity. Pre-orders do not touch stock, matching create and cancel. Cancelled orders cannot be edited, and the order must keep at least one line. Existing lines keep their unit price. New lines use the current selling price, or the discount price when one is set. Totals are recalculated. A paid order’s amount paid follows the new total. The activity feed records `transaction_edited`.

**Payment.** `paymentMethod` is `cash` or `bank_qr`. Bank/QR also stores the payment option id, a name snapshot, and the last 4 digits of the reference once the customer confirms they paid. Showing a QR code does not mark the order paid. Pay later leaves the order unpaid with method `bank_qr`, shown as Pending Payment. A second pay request on an already paid order is rejected. Cash uses the existing mark-paid behavior. Customer shop checkout stays a reservation.

**Roles.** Login returns the granted roles. More than one role shows a picker that calls the existing switch-role endpoint. One role goes straight to its dashboard. The top-bar switch stays the way to change view later. Guards still read the active role.

## Alternatives Considered

- A separate customer display route for stock. Rejected because the staff tab already has the live data.
- A new payment status for pending QR. Rejected because unpaid already means not paid, and reports filter on that.
- Merging role permissions after login. Rejected in the hybrid-roles decision; a view only has that role’s access.

## Consequences

- Postponed QR payments stay in unpaid filters and are labeled Pending Payment in the transactions table.
- Editing a paid order updates the amount paid to the new total. Partial payments stay partial unless the new total is covered.
- A token still keeps its active role until the user picks or switches.
