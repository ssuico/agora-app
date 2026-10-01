# Dark theme as the default

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-01-frozen-mist-palette.md](./2026-10-01-frozen-mist-palette.md) defines cream and charcoal token sets. The stylesheet only applies the charcoal set under `.dark`, and no page adds that class, so the site always opens on cream.

## Decision

Dark is the default. Every layout renders `<html class="dark">`. A short script in the head reads `agora-theme` from local storage and switches to light only when that value is `light`. A sun/moon control in the top bar and on the sign-in screens writes the choice back.

The cream tokens stay the light theme. Orange `#DD700B` with ink `#1C1D1A` stays the action color in both themes. The auth board stays the orange field.

## Alternatives Considered

- Follow the operating-system preference and treat dark as optional. Rejected because the request is for dark to be the site default.
- Drop the cream theme. Rejected because the Frozen mist swatches include cream and frost, and the control keeps that set one click away.

## Consequences

- First paint is charcoal unless the visitor has already chosen light.
- Theme choice is stored in the browser, not on the account.
