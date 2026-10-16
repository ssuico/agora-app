# Export store sheets to Excel

**Date:** 2026-10-16
**Status:** accepted
**Author:** collaborative

## Context

Capital & Expenses sheets are the in-app stand-in for the Google Sheet managers already keep ([notebook](./2026-10-16-store-capital-expenses-sheets.md)). That entry left import and export as follow-ups. Managers now need a file they can download for one tab, or for every tab in the notebook.

## Decision

- An Export menu on the sheet page offers **This sheet** and **All sheets**.
- The file is `.xlsx`. One sheet is a workbook with that tab. All sheets is one workbook with a worksheet per tab, in the notebook's order.
- Cells are the values on screen: text, numbers, dates, and formula results. The total row is included when a column has a total. A cell formula wins over a column formula, the same way it does in the grid.
- The browser sends that snapshot to `POST /api/store-sheets/export/store/:storeId`. The server writes the workbook with ExcelJS and does not store it. Unsaved edits on the open sheet are included. The route still requires a store manager or admin for that store.

## Alternatives Considered

- **CSV.** Rejected for the whole notebook: one CSV cannot hold several tabs. Excel is what Google Sheets imports as a workbook.
- **Excel formulas instead of results.** Rejected: `[Amount]` and row numbers would point at the wrong cells once a header row is added. The downloaded numbers match the sheet.
- **Read the saved documents on the server.** Rejected: the formula engine runs in the browser, and a save might still be waiting. The snapshot already has the results.

## Consequences

- Changing a number later does not update the downloaded file. It is a copy.
- Worksheet names drop characters Excel does not allow and stay within 31 characters. Duplicate names get a numeric suffix.
- The export is not part of dashboard totals.
