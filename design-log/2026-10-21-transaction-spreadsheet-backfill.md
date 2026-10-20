# Temporary spreadsheet backfill for transactions

**Date:** 2026-10-21
**Status:** accepted
**Author:** collaborative

## Context

Sales were written into a spreadsheet instead of the POS. Those rows need to become real transactions so totals, claim state, and payment state match the rest of the app. The sheet only has Customer, Items, Quantity, Claiming, and Payment. Unit price, cost, and profit are not in the file.

This is a one-off local script. It is not part of the running server and does not need a deploy.

## Decision

`server/src/backfillTransactionsFromExcel.ts`, run with `npm run backfill:transactions` from `server/`.

- One spreadsheet row is one transaction. A cell may list several items separated by `;` or a new line, with quantities in the same order.
- Each item name must match one regular product in the chosen store. The script uses that product's current selling price, or its discount price when one is set, and its cost price. Line subtotal, cost, transaction total, and gross profit are computed the same way as checkout.
- Claiming accepts claimed / unclaimed. Payment accepts paid / unpaid, or `partial` plus an amount (for example `partial 150`). Paid rows are recorded as cash. Unpaid and partial rows store no payment method, matching staff checkout.
- A customer name that matches one customer account is linked. A name with no account and no close spelling match is stored as a walk-in. A close match is rejected so a typo is not saved under the wrong person.
- The script prints a per-item price trace and does not write unless `--apply` is passed. A second run skips a row that was already imported with the same values.
- Stock is reduced by the imported quantities, same as a normal sale. `--skip-stock` records the transactions without changing inventory when stock was already adjusted by hand.
- No activity-feed entry is created.

## Alternatives Considered

- **Calling the checkout API.** Rejected: it needs a logged-in session, refuses sales while the store is closed, and would broadcast live activity for old rows.
- **Guessing a product when the name is only similar.** Rejected: the wrong match would attach the wrong price and the totals would be wrong.
- **Writing on the first run.** Rejected: the sheet is not in the repo yet, and the price trace should be reviewed before anything is saved.

## Consequences

- Totals use the prices stored on the product now. If a price changed after the sale, the imported total follows the current price. The trace shows which product and which price were used.
- Re-running after editing a row that was already imported stops on that row until the earlier transaction is removed.
- The script stays in the repo only so it can be run locally. It is not started by the server.
