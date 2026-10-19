# Inventory and pre-order movement

**Date:** 2026-10-20
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-17-move-inventory-to-preorder-shared-history.md](./2026-10-17-move-inventory-to-preorder-shared-history.md) turns a stocked product into a pre-order by setting `stockQuantity` to 0. [2026-10-08-pre-order-products-and-order-types.md](./2026-10-08-pre-order-products-and-order-types.md) treats pre-order demand as open transactions, not as stock. A manager who receives goods for those orders, or who still has pieces on hand, has no way to reserve the promised units before the rest goes on the regular shelf.

## Decision

One product record stays in both selling modes. `stockQuantity` remains the quantity regular sales can take. `reservedQuantity` holds units promised to outstanding pre-orders and is not sellable. Physical stock is the sum of those two. Outstanding demand stays the existing transaction total: pre-order lines that are not cancelled and not both paid and claimed.

On-hand stock fulfills outstanding pre-orders first. Moving or relisting into pre-order keeps the physical quantity and does not decrement it. New pre-orders still do not decrement stock. Listing the product back for regular sales adds the units just received, then:

```
available = physical + received - outstanding
```

When that result would be negative, the relist is rejected and nothing is written. When it is covered, `reservedQuantity` becomes the outstanding count and `stockQuantity` becomes the available count, in one database session with the day’s inventory row and an `InventoryMovement` record.

Closing or unlisting a pre-order only stops new orders. It does not mark orders fulfilled and does not change stock. Cancelling an outstanding pre-order after that reservation moves the units back onto `stockQuantity`. The first time an order becomes paid and claimed, the reserved units drop and the shelf quantity stays put. Leaving that fulfilled state puts the same units back into `reservedQuantity` only, so a later cancel cannot take another order’s reservation.

## Alternatives Considered

- Keep a single stock field and subtract pre-orders from it at listing time. Rejected because a pre-order period would look like a sale and could go negative.
- Store outstanding demand on the product. Rejected because the transactions are already that count, and a second number can drift.
- Put the audit trail on `ActivityLog`. Rejected because those rows expire after 30 days.

## Consequences

- A normal inventory relist treats the entered number as units received, added to the physical quantity, not as a replacement count. Zero is allowed when the stock already covers outstanding pre-orders.
- Regular sales still cannot take reserved units, because they only decrement `stockQuantity`.
- The daily shelf counts regular sales only. A cancelled pre-order that releases reserved units is added to that day's restock, so the row matches the sellable quantity.
- Sales stay on transactions. The movement collection records transfers, receipts, reservations, releases, and fulfillments.
