# Shop banner parallax and sticky customer nav

**Date:** 2026-10-06
**Status:** accepted
**Author:** collaborative

## Context

The shop banner from [2026-10-02-store-banner-image](./2026-10-02-store-banner-image.md) sits in a short 4:1 (desktop) / 3:1 (phone) slot with `object-cover`. Tall collage uploads lose most of their vertical content at rest, and raising the slot would push products down. The customer top bar also scrolls away with the page.

## Decision

- **Keep the display slot height.** The visible banner frame stays `aspect-[3/1]` / `sm:aspect-[4/1]`. No taller product-pushing band.
- **Taller stored asset.** Upload crop moves from 1600×400 (4:1) to 1600×600 (8:3). The extra vertical pixels are surplus for the shorter viewport, so parallax can reveal more of the image instead of inventing height.
- **Parallax inside the slot.** The `<img>` is absolutely filled, scaled (~1.35), and translated on scroll with `requestAnimationFrame`. Reduced-motion users get a static centered crop. Existing 4:1 banners still get motion; managers re-upload once to regain the clipped collage content.
- **Sticky customer nav.** `Topbar` is `sticky top-0` with a solid/blurred card background so it stays readable while the shop scrolls. The app shell already pins its top bar in a flex column, so the same class is a no-op there.

## Alternatives Considered

- **Taller banner slot.** Rejected: crowds the product grid.
- **`object-contain` letterboxing.** Shows the full image but wastes the band and looks sparse.
- **CSS `background-attachment: fixed`.** Unreliable on mobile Safari; JS parallax with reduced-motion opt-out is more predictable.
- **Crop UI with drag/zoom.** Still deferred; center crop into 8:3 is enough with the preview on Storefront.

## Consequences

- Stores with an old 4:1 banner should re-upload for the full collage to show through parallax.
- Banner payload grows slightly (600px tall vs 400px) but stays under the existing char/size caps with the same quality ladder.
