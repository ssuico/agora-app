# Dates, arrow keys, and formula columns on store sheets

**Date:** 2026-10-16
**Status:** accepted
**Author:** collaborative

## Context

The capital and expenses notebook ([store sheets](2026-10-16-store-capital-expenses-sheets.md)) is a free-form grid. Managers want to move through it like a spreadsheet, pick dates from a calendar, and add a column that computes from other number columns (for example amount times quantity, or amount minus a fee). Results stay on the sheet and still do not feed dashboard totals.

## Decision

- Arrow keys move the active cell. Up and down always change rows. Left and right leave a text or number cell only when the cursor is at that edge, so editing a name still works. On a date or formula cell, every arrow key moves.
- Column type `date` uses the browser date control, which includes a calendar. The stored value is `YYYY-MM-DD`. New Capital and Expenses templates use this type for Date. Existing text columns stay as they are until a manager switches the type.
- Column type `formula` stores one expression on the column and evaluates it for every row in the browser. Nothing is written into the financial `Expense` collection.
  - `B` or `[Amount]` means that column on the same row. `B2` means row 2 of column B. Letters follow the current column order.
  - `+ - * /` and parentheses, plus `SUM`, `AVERAGE`, `MIN`, `MAX`, and `ROUND`.
  - `B:B` or `B2:B6` is a range and is only valid inside those functions.
  - A blank number cell counts as zero once any input on the row has a value. A row whose inputs are all blank stays blank.
  - The footer adds up the formula results for that sheet only. A circular reference or a bad expression shows as an error in the cell.

## Alternatives Considered

- **A formula typed into each cell.** Rejected for this pass: managers described a column that reuses other columns, which is one expression applied down the sheet.
- **A custom calendar component.** Rejected: the native date control already opens a calendar and does not add a dependency.
- **Evaluating formulas on the server.** Rejected: the numbers are notes. The server only checks that the formula text is within the cell size limit.

## Consequences

- Reordering columns changes what a letter such as `B` points at. Names in brackets, such as `[Amount]`, stay attached to that column.
- Two people editing still resolve conflicts by version, as before. Formula results are recalculated locally after each load.
