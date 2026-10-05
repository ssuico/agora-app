# Store banner image

**Date:** 2026-10-02
**Status:** accepted
**Author:** collaborative

## Context

The customer shop page (`/shop/[storeId]`) opens with the store name and nothing visual. The request: each store gets a banner image on the shop page, and the Store Manager can set a custom image from the store manager's view.

The app has no file storage. The only upload precedent is the payment option QR code: the browser reads the file as a data URL and the API stores that string in MongoDB (2 MB client limit, 4 MB JSON body limit in `server/src/app.ts`).

## Decision

- **Storage.** Two new fields on `Store`: `bannerImage` (data URL string, `select: false`) and `bannerUpdatedAt` (date, null when no banner). `select: false` keeps the image out of every existing store list and detail response, so `/api/stores`, `/api/stores/:id` and the shop page payload stay small. `bannerUpdatedAt` is the cheap "has a banner" flag and the cache-busting version.
- **Serving.** `GET /api/stores/:id/banner` decodes the data URL and returns the binary image with `Cache-Control: private, max-age=86400`. The shop uses `<img src="/api/stores/:id/banner?v=<bannerUpdatedAt>">`, so a new upload changes the URL and the browser refetches. The image is never inlined in page HTML or React props.
- **Writing.** `PUT /api/stores/:id/banner` with `{ bannerImage: string | null }`; `null` removes the banner. Allowed for admins and for store managers assigned to that store (same `authorize` plus `enforceStoreAccess` pair as the status toggle).
- **Validation (server).** The value must be a base64 data URL of type JPEG, PNG or WebP, at most 700,000 characters, and the decoded bytes must start with the matching magic number. This blocks mislabeled data and oversized writes.
- **Processing (client).** The browser center-crops the chosen image to 4:1 and resizes it to 1600x400, then re-encodes as WebP (JPEG fallback) at quality 0.82, stepping down if still too large. Typical result is 60 to 150 KB, so a 6000x4000 photo is fine to select.
- **Manager UI.** A new "Storefront" tab on the Store Dashboard (`StoreReports`) with a live preview, Upload or Replace, Save and Cancel, and Remove (with confirmation).
- **Shop UI.** `ShopView` shows the banner above the store header (4:1 on wide screens, shorter on phones). Stores without a banner look exactly as before.

## Alternatives Considered

- **Image URL field.** Simplest, but managers would need somewhere to host the image, and hotlinks break.
- **Object storage (S3, Cloudinary).** The right long-term home for images, but it adds a service, credentials and deployment work for one image per store. The data URL approach matches the QR code precedent and can move to object storage later behind the same endpoints.
- **Return the data URL inside the store JSON.** Would add up to hundreds of KB to every store list, the shop page HTML and React hydration props.
- **Crop UI with drag and zoom.** More control, more code. Center crop with a visible preview and a "wide images work best" hint is enough for now.

## Consequences

- Store documents grow by up to about 500 KB when a banner is set; it is excluded from normal queries.
- Banners are only fetched by signed-in users (the endpoint sits behind `authenticate`, like the rest of the API), which matches the shop itself.
- Moving to object storage later only changes the write and read endpoints, not the shop or manager UI.
- The admin Add or Edit Store form does not manage banners; the manager view is the single place.
