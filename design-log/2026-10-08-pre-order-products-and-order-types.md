# Pre-Order products and order types

**Date:** 2026-10-08
**Status:** accepted
**Author:** collaborative

## Context

Store managers need to list products customers can order before the store has stock. Those products must not touch normal inventory (no stock decrement, no negative stock, no appearance in inventory reports). Orders still belong in the existing transaction system.

Today every checkout is a reservation: `createTransaction` always checks and decrements `Product.stockQuantity`, and the storefront copy is "reserve now, pay when you claim". There is no product type and no order type. `Transaction` already has `claimStatus`, `paymentStatus`, and `orderStatus`, plus a derived `completed` from `getDisplayOrderStatus`.

## Decision

### Product type

Add `productType: 'regular' | 'preorder'` (default `'regular'`) to `Product`. Pre-order products also store:

- `preOrderOpen` (boolean, default `true`) — whether new pre-orders are accepted
- `preOrderExpectedDate` (`Date | null`) — expected availability shown on the storefront
- `preOrderStatus: 'pending' | 'ready'` (default `'pending'`) — the manager flips this when the items arrive

A pre-order product is created with `stockQuantity` forced to `0` and never gets an `InventoryRecord`. `productType` cannot change after creation. Queries used for inventory, stock broadcasts, and inventory reports exclude pre-order products with `{ productType: { $ne: 'preorder' } }`, so documents created before this field still count as regular.

Demand is not stored on the product. It is the sum of `TransactionItem.quantity` on pre-order transactions that are still open: not cancelled, and not yet both paid and claimed. Customer count is the number of distinct customers (or walk-in names) on those orders. Fulfilled and cancelled orders stay in the order list, but they are not part of the "units to prepare" number.

### Order type

Add `orderType: 'regular' | 'reserved' | 'preorder'` (default `'regular'`) to `Transaction`. Assignment:

- Customer storefront checkout → `reserved`
- Staff "New Transaction" → `regular`
- "Pre-Order Now" → `preorder`, and every line must be an open pre-order product

A pre-order transaction skips the stock check and decrement. Cancelling or deleting one does not restore stock. A regular cart that contains a pre-order product is rejected.

Existing transactions are not backfilled. They read as `regular`, matching the no-guessing precedent in [2026-10-05-transaction-paid-claimed-dates.md](2026-10-05-transaction-paid-claimed-dates.md).

### Pre-order status (derived)

Per-order status is derived, the same way `completed` is derived:

- `orderStatus === 'cancelled'` → cancelled
- paid and claimed → fulfilled
- product `preOrderStatus === 'ready'` → ready
- otherwise → pending

No extra stored status in the first version.

### Surfaces

- Store manager sidebar gets a Pre-Orders page: list demand (units and customers), create/edit, open/close, mark ready, view the orders.
- Storefront gets a Products | Pre-Orders tab. Pre-order cards show the badge, price, expected date, and count. "Pre-Order Now" opens a quantity dialog and creates one pre-order transaction. Pre-order products never enter the reservation cart.
- The Transactions page, My Purchases, and the transaction Excel report label each order Regular, Reserved, or Pre-Order.

## Alternatives Considered

- **A separate PreOrder collection and order system.** Rejected: it would duplicate product fields and split transaction history.
- **Negative `stockQuantity` as the pre-order count.** Rejected: it would break the `min: 0` constraint and every inventory report.
- **Treat all existing checkouts as `regular` and leave `reserved` unused.** Rejected: the storefront flow is already a reserve-and-claim, and the manager wanted that distinction now.
- **Put pre-order items in the regular cart and split the checkout.** Rejected: mixing stock and demand items in one cart makes the stock checks and the customer copy confusing. A direct dialog keeps the two flows separate.

## Consequences

- Transactions created before this change display as Regular even when a customer placed them. That is intentional; we do not guess which old rows were reservations.
- Revenue reports still include pre-order transactions, because they are real orders. Only inventory snapshots and stock math exclude pre-order products.
- Fulfillment stays coarse: one product-level Ready flag applies to every open pre-order for that product. A per-order override can be added later without changing the derived-status shape.
- No quantity cap, deposit, or "items arrived" notification in this version.
