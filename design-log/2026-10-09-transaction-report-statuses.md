# Transaction reports use the same status labels as the screen

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

The transactions table shows order status (Active, Completed, Cancelled), claim status, payment status, and, for pre-orders, Pending, Ready, Fulfilled, or Cancelled. The generated Excel file already had order, claim, and payment columns, but it wrote the stored words (`active`, `unclaimed`, `paid`). It did not include the pre-order status. Cancelled orders were left out of the file, so that status never appeared.

## Decision

Newly generated transaction reports use the same words as the screen:

- Order Status: Active, Completed, or Cancelled
- Claim Status: Claimed or Unclaimed
- Payment Status: Paid, Unpaid, or Partial
- Amount Paid, so a partial payment is visible next to its status
- Pre-Order Status: Pending, Ready, Fulfilled, or Cancelled on pre-order rows, blank on regular and walk-in rows

Cancelled orders are included. Their amounts stay on the row so the status can be filtered in Excel. Reports already saved are unchanged until they are generated again.

## Alternatives Considered

- **Keep the raw stored words.** They are in the file, but they do not match the labels staff read on the transactions page.
- **Leave cancelled orders out.** The sales total stays easier to sum, and the Cancelled status never shows up.

## Consequences

- Summing Total Amount in Excel now includes cancelled orders. Filter Order Status to exclude Cancelled before treating the column as sales.
- Pre-order status comes from the same rule as the pre-order orders list: cancelled, then paid and claimed (Fulfilled), then the product's ready flag, otherwise Pending.
