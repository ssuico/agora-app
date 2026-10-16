# Product notes are the customer description

**Date:** 2026-10-17
**Status:** accepted
**Author:** collaborative

## Context

Products already store a free-text `notes` field. Staff enter it as "Additional Notes" or "Notes", and customers never see it on the shop. Transaction notes and customer reservation notes are a different field.

## Decision

The product `notes` value is the product description. Staff labels, inventory columns, and the inventory export call it Description. The stored field name stays `notes`, so existing products and reports keep their data.

Customers see that description on the shop Products tab and the Pre-Orders tab, on the card and in the product or pre-order dialog. Empty descriptions are omitted. Denser grids clamp the text; the dialog shows the full description.

## Alternatives Considered

- **Add a new `description` field and leave notes internal.** Staff would have to retype text that is already the product description.
- **Show the description only inside the product dialog.** The card is the view customers scan first, so the text has to be on the card.

## Consequences

- Order notes, reservation notes, and the capital-and-expenses notebook are unchanged.
- Long descriptions are clamped on the card and fully visible in the dialog.
