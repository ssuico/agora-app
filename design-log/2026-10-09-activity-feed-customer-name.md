# Activity feed uses the customer on the transaction

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

Recent Activity on the storefront is written when an order is created. The name came from the signed-in user when that user was a customer, and otherwise from `walkInCustomerName`, falling back to "Walk-in customer". Staff often attach a registered customer and leave the walk-in name empty, so those orders — including regular checkouts keyed in at the counter and walk-in orders — all showed as "Walk-in customer".

## Decision

The activity name comes from the transaction:

1. The registered customer's name, when `customerId` is set.
2. Otherwise `walkInCustomerName`.
3. "Walk-in customer" only when the transaction has neither.

The avatar follows that same person. On database connect, reservation and pre-order activity rows that still say "Walk-in customer" are rewritten from the linked transaction.

## Alternatives Considered

- **Keep labeling staff-entered orders as the staff member.** The feed is about who the order is for, and the transaction already stores that name.
- **Fix only new orders.** The storefront would keep showing the wrong recent rows until they aged out.

## Consequences

- A walk-in with no name typed and no registered customer still reads "Walk-in customer".
- Rows already saved are corrected the next time the API connects. The message stays "placed a reservation" or "placed a pre-order".
