# Login page Discover section

**Date:** 2026-10-14
**Status:** accepted
**Author:** collaborative

## Context

Sign-in is the public entry. [2026-10-01-auth-stall-board.md](./2026-10-01-auth-stall-board.md) keeps login, signup, and password reset on one shell: a full-viewport hero over a fixed photo, with the form in `AuthShell`. Nothing below that hero explains what Agora does.

[2026-10-01-customer-self-signup.md](./2026-10-01-customer-self-signup.md) forces every public signup to `customer`. [2026-10-02-hybrid-roles-and-view-switch.md](./2026-10-02-hybrid-roles-and-view-switch.md) lets only an admin grant extra roles, and a hybrid account switches views from the top bar. New visitors do not see that until they are inside the app.

## Decision

Add a public section under the login hero, reached by scrolling or by a "Discover Agora" hint fixed to the bottom center of the viewport. The hint fades after the visitor scrolls about 40% of the viewport height. Signup and password reset stay unchanged.

The section is a solid `bg-canvas` sheet so it stays readable over the fixed photo in light and dark. It covers:

- What Agora is: pick a location, browse a store, reserve or pre-order, pay with the store's QR options, claim in person.
- A four-step "How it works".
- An explicit role note: every new account is a Customer; only an admin can add the Store Manager role; once granted, the account switches views from the top bar.
- Customer and Store Manager only. Admin screens are left out.
- Code-built mock previews of those screens (storefront, location picking, purchases, dashboard, inventory, pre-orders, transactions). The mock body is hidden from assistive tech; a caption states what the screen is. No live data and no screenshots.

The layout grows an optional `below` slot rendered after the hero. The hint appears only when that slot is filled. Login passes the Discover section through it.

## Alternatives Considered

- Screenshots of the real app. Rejected because they go stale and need seed data to capture.
- A separate `/about` route. Rejected because the intro should sit on the page people already open.
- The same section under signup. Deferred; this pass is login only.
- Absolute positioning inside the hero. A fixed hint stays on screen when the sign-in card is taller than the viewport.

## Consequences

- Copy and mocks describe the current customer and store-manager screens. They need a pass when those screens change.
- The section is public, so the mocks use invented store and product names.
- The hint is extra UI on the login hero only. Reduced motion disables the chevron bounce and the smooth scroll.
- The auth photo is positioned inside the hero (`absolute` on `.auth-backdrop`) so it does not cover or block the section below. It was `fixed` when the hero was the whole page.
