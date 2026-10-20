# Spreadsheet backfill groups consecutive rows into one order

**Date:** 2026-10-21
**Status:** accepted
**Author:** collaborative

## Context

Supersedes the one-row-per-transaction rule in [2026-10-21-transaction-spreadsheet-backfill.md](2026-10-21-transaction-spreadsheet-backfill.md).

The uploaded sheet lists one item per row. The same customer is repeated on consecutive rows for a single order, with Claiming and Payment filled on every row. Inventory for these sales is already in the store, so creating the orders has to reduce that stock.

## Decision

- Consecutive rows with the same customer are one transaction. A later block of rows for that customer is a separate order.
- Every row in the block must share Claiming and Payment. `RESERVED` is stored as unclaimed.
- The product price, cost, and totals still come from the matching product. The trace names that product and the price used.
- On `--apply`, stock is reduced by the order quantities. The import is refused when a product does not have enough on hand.
- When several stores exist, the script uses the only store whose products can match every item name. `--store` overrides that.

## Alternatives Considered

- **One transaction per row.** Rejected: a customer who bought pancit and lumpia would show up as two sales.
- **Leaving stock unchanged.** Rejected: the on-hand counts were prepared for these sales, so the orders have to consume them.

## Consequences

- A product name that differs from the sheet (for example a longer catalog name) is used only when it is the only match in that store. The trace shows both names.
- If two products in the store still share the price, the script stops and lists them instead of choosing.
- Nothing is written while any row fails validation, including a stock shortage.
