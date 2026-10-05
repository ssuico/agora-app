# Shop banner: full image, fade into the page, parallax

**Date:** 2026-10-06
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-06-shop-banner-parallax-sticky-nav](./2026-10-06-shop-banner-parallax-sticky-nav.md) kept a short 4:1 window, so a collage stayed chopped and parallax had almost no pixels to move. [2026-10-06-banner-fit-contain](./2026-10-06-banner-fit-contain.md) stopped the upload crop, but the shop still letterboxed that file inside the short slot.

## Decision

- The shop shows the image at its natural aspect ratio (full width, height from the file). No fixed 3:1 or 4:1 window.
- A gradient over the banner runs from transparent at about 42% of the height to `--canvas` at the bottom, so the lower half dissolves into the page instead of ending on a hard edge.
- The store title row overlaps that fade, so products are not pushed down by the full image height.
- Parallax: the image stays pinned under the nav for 240px of scroll while the store header and products slide over the fade. The picture is not translated inside a clipping box, which was slicing it down to a strip.
- The banner bleeds to the edges of the customer page padding.
- New uploads keep the source aspect ratio, scaled to fit inside 1600×1400. No center crop and no letterbox canvas.

## Alternatives Considered

- **Keep the short slot and only fade it.** Still hides most of a tall collage.
- **Scale the image up for parallax headroom.** Zooms in and crops the edges the user asked to see.
- **Fixed background attachment.** Unreliable on mobile.

## Consequences

- A banner saved before this change is still the old center crop. Re-upload once to store the full collage.
- A very tall upload makes a taller hero; the bottom half is fade, not a solid block.
