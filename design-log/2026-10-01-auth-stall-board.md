# Auth stall board

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

Sign-in, signup, and password reset share one split panel: a navy-to-copper gradient, three equal stat tiles, and a glass card. The tiles repeat marketing claims. The same shell is copied on each page. Interface review also found missing form names, straight ellipses in loading text, decorative icons exposed to assistive tech, and no skip link.

## Decision

Keep the existing Agora palette (navy `#262A56`, copper `#B8621B`, parchment `#F4EDE1`, sand `#E3CCAE`). Replace the gradient and stat tiles with one stall board: a copper upright on the left, a condensed “Agora” sign, and a posted list of the real entry rules for that page. The form sits on the parchment side. The form title is the page `h1` so it remains when the board is hidden on small screens.

Email confirmation stays behind `EMAIL_VERIFICATION_ENABLED`. This change does not turn mail back on.

## Alternatives Considered

- A new type system and palette. Rejected because the product already names its colors.
- Restyling every store and admin screen in the same pass. Rejected because those screens already share the app shell; the broken pattern is the public entry.

## Consequences

- Login, signup, and password reset use one shell.
- The floating color orbs on the auth background are removed.
