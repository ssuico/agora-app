# One listing history row per product

**Date:** 2026-10-17
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-17-move-inventory-to-preorder-shared-history.md](2026-10-17-move-inventory-to-preorder-shared-history.md) stored inventory and pre-order periods side by side and showed one history row per source. Moving a stocked product closed its inventory period and created a new pre-order period, so the same product appeared twice: an unlisted inventory row and a listed pre-order row. Relisting the other way did the same in reverse.

A product is sold from one place. It is either in today's inventory or on pre-order, never both.

## Decision

Listing history shows one row per product. The Listing badge is the product's current place: Inventory or Pre-order. Moving or relisting updates that place on the existing listing records instead of adding a listing of the other type.

- Moving today's inventory into pre-order changes the product's listing source to pre-order and leaves that listing open. It does not write a closed inventory twin.
- Relisting into inventory or pre-order retargets every listing for that product to the chosen source, then opens one listing only when none is already open.
- A product that already has listings of both sources keeps the listings that match its current product type. The other source is removed once, the next time the API connects.
- A listed pre-order still has to be unlisted before it can be placed in today's inventory, so the two catalogs cannot both carry it.

## Alternatives Considered

- **Keep both rows and mark the old one unlisted.** That is the current behavior, and it reads as a duplicate product.
- **Hide the extra row in the UI only.** The second listing would still exist and could be treated as a second catalog entry later.

## Consequences

- Times listed counts periods of the current source. The closed twin created by an earlier move is dropped, so that move no longer adds an extra count.
- This supersedes the "one row per source" display in the 2026-10-17 shared-history entry. Stock math still uses `InventoryRecord`.
