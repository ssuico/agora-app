# Customers request order cancellation; store managers approve or decline

**Date:** 2026-10-10
**Status:** accepted
**Author:** collaborative

## Context

Only admins and store managers can cancel an order (`PATCH /api/transactions/:id/cancel`). Customers have no
way to withdraw an order they placed. The request is to let customers cancel, but keep the store manager in
control: a customer cancellation must be approved on the manager's side.

Related: [transaction report statuses](2026-10-09-transaction-report-statuses.md) (Order Status is derived from
`orderStatus`, claim and payment) and [pre-order products](2026-10-08-pre-order-products-and-order-types.md)
(cancelling a pre-order does not touch stock).

## Decision

A customer's cancel action creates a **cancellation request**, not a cancellation. The order stays `active`
(stock, reports and totals are unchanged) until the manager approves.

- `Transaction.cancellationRequest` (optional): `status` (`pending` | `approved` | `rejected`), `reason`,
  `requestedAt`, `resolvedAt`, `responseNote`.
- `POST /api/transactions/:id/cancel-request` (customer): only on the customer's own order that is active,
  not cancelled, not claimed, and has no pending request. Requires a reason of at least 2 words (same rule as
  store rating updates). After a decline the customer may request again with a new reason.
- `PATCH /api/transactions/:id/cancel-request` (admin / store manager): `decision: 'approve' | 'reject'` and an
  optional `note` for rejections. Approve runs the same cancellation logic as the manager's cancel button
  (stock restored for regular orders, pre-order demand re-broadcast). Reject keeps the order active.
- The manager's existing direct Cancel button also resolves a pending request as approved.
- The store room gets `transaction:updated` (the row updates live) and a `transaction:cancel-requested` event
  that shows a toast on the manager's Transactions page. It is deliberately not written to the activity feed,
  because that feed is also shown to shoppers on the storefront, and the event carries no customer details.
- Manager UI (`TransactionManager`): a "Cancel requested" badge on the row, Approve / Decline actions that show
  the customer's reason, and an Order filter option "Cancel requested".
- Customer UI (`PurchasesTable`): a "Cancel order" button on eligible orders opening a reason dialog; the row
  shows "Cancellation pending", or "Cancellation declined" with the manager's note.

## Alternatives Considered

- **Add a `cancel_requested` value to `orderStatus`.** Rejected: every report and stock query filters on
  `orderStatus`, so a third value would leak into them and needs to count as active everywhere.
- **Let customers cancel instantly while unpaid.** Rejected: the request is explicit that the manager approves.
- **Separate `CancellationRequest` collection.** Rejected: one request per order at a time; embedded fields
  keep list queries and sockets simple. Past declined reasons are overwritten by a new request.

## Consequences

- A declined request is replaced if the customer asks again, so only the latest request is kept.
- Customers do not get a live notification of the decision; they see it the next time they open My Purchases.
- Claimed orders cannot be cancelled by the customer; the manager can still cancel directly.
