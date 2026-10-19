# Fullscreen stock grid

**Date:** 2026-10-20
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-20-pos-enhancements.md](./2026-10-20-pos-enhancements.md) hid the 3 / 6 / 9 column picker while Realtime Stocks is fullscreen, and used a fixed large-card layout. A store with more products than that layout can show has to scroll, so items at the bottom are easy to miss on a customer-facing display.

## Decision

The same 3 / 6 / 9 control stays available in fullscreen and still uses the shared column preference. The fullscreen grid uses that column count and splits the remaining viewport into equal rows, so every visible product fits on one page. Denser choices use smaller type and drop the square image so the rows can shrink. Search, the live stock source, and Exit / Escape stay as they are. The inventory tabs stay outside the fullscreen panel.

## Alternatives Considered

- Leave the fixed four-column layout and only add more columns. Rejected because the large cards still overflow the screen.
- Add a separate “fit all” button. Rejected because the existing column control already chooses how much fits.

## Consequences

- Nine columns, or a long list, uses smaller type so the board can stay on one page.
- The chosen density is the same one used by the other catalogs that share this control.
