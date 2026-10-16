# Cell formulas and inserting columns

**Date:** 2026-10-16
**Status:** accepted
**Author:** collaborative

## Context

Column formulas on Capital & Expenses sheets are in place ([dates and formulas](./2026-10-16-store-sheet-dates-and-formulas.md)). That entry kept formulas on the whole column. Managers also need a formula on one cell, and a way to insert a column beside an existing one instead of only appending at the end.

## Decision

- Typing `=` at the start of a text or number cell opens the formula dialog for that cell only. Saving stores the formula in the cell as text beginning with `=`. The cell shows the computed result. Clearing the formula and saving leaves the cell empty.
- A cell formula wins over a column formula on that row. Other rows keep the column formula.
- The same formula language applies. A cell that references itself is a circular reference.
- Number totals include cell-formula results. A column formula that already aggregates a range (the formula text contains `:`) still contributes once in the footer.
- The column menu gains Insert left and Insert right. The new column is text, and its name is selected for editing. The end-of-grid add button still appends.

## Alternatives Considered

- A second formula language for cells. Rejected; one language keeps letters, labels, and functions the same.
- Insert only from the add-column button. Rejected; managers asked to place a column beside the one they are editing.

## Consequences

- Letters stay positional, so inserting a column shifts later letters. `[Label]` references do not move.
- Date cells do not start a formula; a date column stays a date.
- Formulas still do not leave the sheet or affect dashboard totals.
