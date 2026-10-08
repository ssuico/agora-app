# Closed stores can still be entered for pre-orders

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-09-pre-order-listing-cutoff-and-closed-store.md](2026-10-09-pre-order-listing-cutoff-and-closed-store.md) keeps the Pre-Orders tab usable after a customer is already inside a closed shop. The store picker still treats a closed store as a dead card, so the customer never reaches that tab.

## Decision

On the store list, a closed store stays out of the regular shop link. The card shows a Pre-order items button that opens `/shop/:storeId`. That page already lands on Pre-Orders when the store is closed. Reservations stay paused. Maintenance is unchanged.

## Alternatives Considered

- **Make the whole closed card open the shop.** Rejected: the card would look like a normal store visit. A labeled button makes the pre-order path obvious.
- **Leave the card disabled.** Rejected: customers cannot reach pre-orders at all.

## Consequences

- Closing a store no longer hides its pre-order listings from the location's store list.
