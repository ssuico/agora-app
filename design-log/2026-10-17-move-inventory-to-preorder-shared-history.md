# Move inventory into pre-order and share listing history

**Date:** 2026-10-17
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-08-pre-order-products-and-order-types.md](2026-10-08-pre-order-products-and-order-types.md) locked `productType` at creation and kept pre-orders out of `InventoryRecord`. [2026-10-09-pre-order-listing-cutoff-and-closed-store.md](2026-10-09-pre-order-listing-cutoff-and-closed-store.md) gave pre-orders their own history, and only after unlist. Inventory history is the opposite list: products missing from today. A manager cannot move stocked items into pre-order, and the two histories do not show the same products.

## Decision

A manager can select several products on today's inventory and move them to pre-order with one expected availability and one orders-close time. Each product becomes `preorder`, its stock is set to 0, and today's inventory record is removed. Past inventory records stay. The shared window uses the same rules as creating a pre-order.

Listing history is one list on both the Inventory page and the Pre-Orders page. A row is a product listed from inventory or from pre-order, badged with that source. A product appears as soon as it is listed, including while it is still listed. Relist is offered only when that listing is not current, and the manager chooses inventory or pre-order. Choosing pre-order asks for the window. Choosing inventory asks for quantity and price. A product that is still listed in either place cannot be relisted until that listing ends.

Inventory listing periods are stored beside pre-order periods, distinguished by `source`. Stock math still uses `InventoryRecord`.

On today's inventory the move action stays visible, and stays disabled until at least one product is selected, with a short note that selection is how items leave inventory for pre-order. Relist defaults to the page the manager is on: inventory from Inventory listing history, pre-order from Pre-Orders listing history. The other destination remains available in the same dialog.

## Alternatives Considered

- **Keep two histories and only add a move button.** The manager asked for one history that already contains a listing on the day it starts.
- **Reuse `InventoryRecord` rows as the pre-order history.** Those rows are daily stock counts. A pre-order has no stock.

## Consequences

- `productType` can change when a product is moved or relisted. This supersedes the fixed-at-creation rule in the 2026-10-08 entry.
- Existing inventory days are recorded once as a listing period the next time the API connects, so current stock shows up in history without waiting to be unlisted.
- Orders already placed are not cancelled when a product moves to pre-order.
