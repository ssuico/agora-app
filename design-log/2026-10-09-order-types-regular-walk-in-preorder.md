# Order types are regular, walk-in, and pre-order

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-08-pre-order-products-and-order-types.md](2026-10-08-pre-order-products-and-order-types.md) labeled customer checkout `reserved` and staff "New Transaction" `regular`. Both of those orders are reservations: the customer reserves from the shop, and staff reserve a walk-in at the counter. A separate Reserved type repeats that.

## Decision

`orderType` is `regular | walk-in | preorder`.

- Customer storefront checkout → `regular`
- Staff "New Transaction" → `walk-in`
- "Pre-Order Now" → `preorder`

`reserved` is no longer stored or offered in filters. Transactions, My Purchases, and the Excel report label the three types Regular, Walk-in, and Pre-Order.

On database connect, a one-time migration runs if it has not been recorded in `migrations`:

1. Existing `reserved` rows (customer checkout) become `regular` and are marked so the next step can tell them apart.
2. Unmarked `regular` rows (staff orders) become `walk-in`.
3. The mark is removed after the run is recorded.

Documents with no `orderType` stay unset and still display as Regular.

## Alternatives Considered

- **Rename only the badge and keep storing `reserved`.** Rejected: the filter and the stored value would still be a type the manager asked to remove.
- **Map `regular` to walk-in on every read.** Rejected: new customer orders are also stored as `regular`, so a permanent read map would label them walk-in.

## Consequences

- Customer rows are marked before staff rows move. Moving every `regular` row first, then renaming `reserved`, is only safe when nothing retries the first step after the second has run.
- The migration record stops a later server start from converting new Regular orders into Walk-in.
- Storefront copy can still say the customer reserved items. That describes the claim-later flow, not the order type.
