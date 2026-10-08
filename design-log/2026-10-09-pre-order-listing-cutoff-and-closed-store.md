# Pre-order listing history, order deadline, and closed-store access

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-08-pre-order-products-and-order-types.md](2026-10-08-pre-order-products-and-order-types.md) added pre-order products that never enter inventory. Three gaps showed up in use:

- Regular products can leave today's inventory and come back from Listing History. Pre-order products had no equivalent, so a finished listing stayed on the active page forever.
- Closing the store hid the whole shop, including pre-orders. A pre-order is not a same-day reservation, so it should still be placeable after close.
- Nothing stopped a customer from pre-ordering right up against the day the goods are expected. The manager is the one who knows when ordering has to stop.

## Decision

### Listing history

A `PreOrderListing` records each time a pre-order product is on the storefront: `listedAt` and `unlistedAt` (null while it is current). Creating a pre-order product opens the first listing.

The active Pre-Orders list and the storefront show products that have an open listing. A product created before listings existed, with no listing rows, stays active so it does not disappear.

**Unlist** closes the open listing and turns `preOrderOpen` off. The product moves to a Listing History tab on the Pre-Orders page, with last listed, unlisted, and times listed. **Relist** opens a new listing, sets status back to pending, and requires a new order deadline. **Delete** on a history row removes the product. Orders already placed stay on the transaction record.

### Order deadline

`preOrderClosesAt` is a date and time the manager sets, on the Eastern clock (`America/New_York`), the same zone the rest of Agora calls EST. The form sends the wall-clock value and the server stores the matching instant. Expected availability is an Eastern calendar date. The deadline must fall before the start of that date. After the deadline, customers cannot place the pre-order even if the listing is still open. The storefront shows the deadline in EST and disables Pre-Order Now once it has passed.

If an expected availability date is also set, the deadline must be before that date. The manager chooses the cutoff; it is not calculated from the expected date.

### Closed store

`createTransaction` still rejects regular and reserved orders when the store is closed. A pre-order is allowed. The shop no longer replaces the whole page with "Store Closed". The Products tab explains that reservations are paused, and the Pre-Orders tab stays usable. Opening the shop while the store is already closed lands on Pre-Orders. Maintenance still blocks the whole shop.

## Alternatives Considered

- **Reuse `InventoryRecord` for pre-order listings.** Rejected: those rows drive stock math, which pre-orders must not touch.
- **Derive the deadline as "one day before the expected date".** Rejected: only the manager knows how early ordering has to stop.
- **Keep pre-orders behind the closed-store screen with a separate URL.** Rejected: the storefront already has a Pre-Orders tab. Keeping that tab reachable is enough.

## Consequences

- A pre-order with no deadline (created before this change) stays orderable until the manager sets one or unlists it.
- Unlisting does not cancel existing pre-orders. Demand for units still to prepare still counts those orders.
- Relisting starts a new window and marks the product pending again. Earlier orders remain in View Orders.
