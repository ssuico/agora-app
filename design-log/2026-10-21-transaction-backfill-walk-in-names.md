# Spreadsheet backfill stores every name as a walk-in

**Date:** 2026-10-21
**Status:** accepted
**Author:** collaborative

## Context

Supersedes the customer-account matching in [2026-10-21-transaction-spreadsheet-backfill.md](2026-10-21-transaction-spreadsheet-backfill.md). The sheet uses short names. Linking those to accounts would attach sales to the wrong people.

## Decision

Every row is a walk-in. The sheet name is stored as `walkInCustomerName`, `customerId` stays empty, and `orderType` is `walk-in`. Consecutive rows for the same name are still one order.

## Alternatives Considered

- **Link a name when it exactly matches one customer.** Rejected: the sheet is a counter list, and an exact match would still be the wrong account for a shared first name.

## Consequences

- These orders do not appear under a customer's My Purchases.
- The name on the order is the text from the sheet.
