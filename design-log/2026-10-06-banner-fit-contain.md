# Banner upload fits the whole image

**Date:** 2026-10-06
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-06-shop-banner-parallax-sticky-nav](./2026-10-06-shop-banner-parallax-sticky-nav.md) and the original banner entry used a center **cover** crop into a fixed canvas. Collages still looked chopped on the shop page even after switching the display to `object-contain`, because the discarded top and bottom were never stored. The shop slot already showed 100% of the 4:1 file.

## Decision

- Upload processing uses **contain**: scale the source to fit inside 1600×600, letterbox on a light `#f0f0f0` fill, never crop.
- Shop display stays `object-contain` in the short 3:1 / 4:1 slot so the stored asset is not cropped again.
- Existing banners that were cover-cropped must be re-uploaded once to regain the full collage.

## Alternatives Considered

- **Taller shop slot.** Still rejected (product grid).
- **Display-only zoom out.** Impossible for legacy 4:1 files that already match the slot; no extra pixels exist.

## Consequences

- New banners may show light bars in the Storefront preview when the source aspect differs from 8:3; that is intentional.
- File size stays in the same quality ladder.
