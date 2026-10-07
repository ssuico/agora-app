# Customer Feedback: list every rater per store and per product

**Date:** 2026-10-07
**Status:** accepted
**Author:** collaborative

## Context

The Store Manager "Customer Feedback" tab (`CustomerFeedback.tsx`, backed by `GET /api/ratings/aggregates`)
did not show every user who rated:

- Store tab: the server only returned store ratings that had a comment (`comment: { $ne: null }`) and capped
  them at 20, so star-only raters were invisible while the header count included them.
- Product tab: per-product rows showed only an average and count with no raters; the flat list was capped at
  200 rows and rendered an empty paragraph for star-only ratings.
- Deleted users rendered as "Anonymous"; deleted products were silently dropped from the per-product breakdown
  (`$unwind` without preserving) even though they counted in the overall total.
- Refresh unmounted the tabs, resetting the active tab.

`ShopView.tsx` (customer-facing) also consumes `product.perProduct` and `product.recentFeedback`, so those
shapes must stay compatible.

## Decision

- Server (`getRatingAggregates`): fetch all store and product ratings (no comment filter, no cap), populate
  customer `name avatar`, and build `perProduct` in code with a nested `ratings[]` per product (customer name,
  avatar, stars, comment, date). Deleted products/users are grouped under "Deleted product" / "Deleted user"
  so counts always match visible rows. `recentFeedback` keeps its shape (product list still capped at 200 for
  `ShopView`); `store.recentFeedback` now contains all store ratings.
- Client: per-product rows expand to show each rater; "All Product Ratings" and "All Store Ratings" lists are
  built from the uncapped data, show avatar, name, stars, and "No comment left" for star-only ratings.
  Refresh keeps the active tab and shows a spinner instead of the skeleton.

- Storefront (`ShopView.tsx`): the store rating summary in the header is a button ("View all ratings") that
  opens a dialog listing every customer who rated the store (avatar, name, stars, date, comment), reusing
  `store.recentFeedback`. Product reviews already display reviewer names, so this matches existing
  transparency. The list refreshes after a customer submits or updates their rating.

- Store rating updates: a customer's first store rating needs no comment. Changing an existing store rating
  requires a comment of at least 2 words (the reason for the change), enforced in the Rate Store dialog
  (required label, hint, disabled submit) and in `createRating` (400 with a clear message). The new comment
  replaces the previous one, so the public list shows the latest reason. Product ratings are unchanged.

## Alternatives Considered

- Paginated "load more" endpoint: unnecessary at current rating volumes; revisit if stores exceed a few
  thousand ratings.
- Restricting the endpoint to managers: rejected because customers use it in `ShopView`.

## Consequences

- Response size grows with rating count (one entry per rating).
- `store.recentFeedback` semantics changed from "recent comments" to "all store ratings".
