# Frozen mist palette

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

The stall board in [2026-10-01-auth-stall-board.md](./2026-10-01-auth-stall-board.md) kept navy `#262A56`, copper `#B8621B`, and parchment `#F4EDE1`. The product now uses the Frozen mist reference: stone `#7C7D75`, mid gray `#ADACA7`, cream `#FCF8D8`, frost `#D9DADF`, and orange `#DD700B`. That entry still holds for the board layout. This entry replaces only the color decision.

## Decision

Map the swatches onto the shared tokens in `src/styles/global.css`, so store and admin screens move with the public auth screens.

- Page and form ground is cream `#FCF8D8`. Cards are a warmer white. Borders and inputs are mid gray `#ADACA7`. Frost `#D9DADF` is the muted surface and the sidebar.
- Actions use orange `#DD700B` with ink `#1C1D1A`. White type on that orange is about 3.3:1, so buttons, the auth board, and the active nav item use the dark ink from the swatch labels.
- Body text is a darker stone ink `#2A2B28`. Muted text is `#5E5F59`. The mid stone `#7C7D75` stays a chart and badge color, because it is too light for small type on cream and too light for cream type on itself.
- The auth board is the orange field, with a cream upright. The mobile wordmark is orange on cream.
- Dark mode is charcoal drawn from the stone, with cream type and the same orange actions.

## Alternatives Considered

- Stone `#7C7D75` as the auth board with cream type. Rejected because that pair is about 4:1, under the 4.5:1 needed for the posted rules.
- Leaving store and admin screens on navy. Rejected because those screens read the same tokens, and a leftover navy active state would split the product in two.

## Consequences

- Login, signup, password reset, and the signed-in shell share one palette.
- Chart series that were hardcoded blue, purple, and green stay as data colors. Status toasts stay green, red, and blue.
