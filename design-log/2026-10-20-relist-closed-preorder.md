# Relist a closed pre-order onto today's shelf

**Date:** 2026-10-20
**Status:** accepted
**Author:** collaborative

## Context

Listing history offers Relist once a pre-order period is closed. `POST /api/inventory/relist` then returns 409, "This product already has an active listing for today", because an inventory row for today is still in the database. The product is `productType: preorder` and is excluded from the daily shelf, so that row is not an active listing. A second relist of a product that is already regular must still be rejected, so a receipt is not applied twice. See [inventory and pre-order movement](./2026-10-20-inventory-preorder-movement.md).

## Decision

The "already listed today" rejection applies only when the product is still a regular product. Relisting a closed pre-order deletes today's inventory row in the same session and writes the reconciled row. An open pre-order period is still rejected until it is unlisted. Shortage is still rejected.

## Alternatives Considered

Hiding Relist while the leftover row exists would leave the products stuck off the shelf. Deleting the rows by hand would not stop the next closed pre-order from hitting the same rejection.

## Consequences

The first inventory relist after a pre-order can receive stock and reserve outstanding orders. A repeat relist the same day still returns 409 once the product is regular. The GET to `/api/inventory/relist` is not a relist path; that route stays POST only.
