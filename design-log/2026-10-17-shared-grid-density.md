# Shared product grid density

**Date:** 2026-10-17
**Status:** accepted
**Author:** collaborative

## Context

The storefront product catalog can be shown as 3, 6, or 9 columns. Pre-order cards were a separate, larger layout with no density control. Realtime Stocks has the same three densities, but each screen forgot the choice on refresh.

## Decision

Pre-order cards use the same image heights and column counts as product cards. The pre-order catalog gets the same 3 / 6 / 9 control. The last choice is stored in `localStorage` under `agora-grid-cols` and read by every screen that offers those densities, so a refresh keeps it.

## Alternatives Considered

- **Remember the density separately on each page.** The request is one choice that follows the person across those screens.
- **Leave pre-order cards at the large size and only add the control.** The large cards were the problem; the control has to change their size.

## Consequences

- Until someone picks a density, each screen keeps its current default. After a pick, every screen starts from that saved value.
- Denser pre-order cards hide the longer deadline copy so the card stays the same height as a product card.
