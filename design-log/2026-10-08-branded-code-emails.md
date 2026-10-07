# Branded HTML emails for signup and password-reset codes

**Date:** 2026-10-08
**Status:** accepted
**Author:** collaborative

## Context

[SendGrid email hardening](2026-10-07-sendgrid-email-hardening.md) turned the code flow back on. The emails it sent were a few lines of unstyled HTML with no branding. They also landed in the recipient's spam folder.

Headers from the test message showed:

- `dkim=pass` and `spf=pass`, but both for `sendgrid.net`, not for `outdoorequipped.com`. Neither aligns with the `From` address, and there was no DMARC result.
- The DKIM records already in DNS (`s1`/`s2._domainkey`) point at SendGrid user `6948496`. The message was sent by SendGrid user `10869684`, the account that owns the current key. The domain was authenticated on a different SendGrid account, so the current account signs with SendGrid's default key.
- The DMARC record is published as a TXT record on the root domain. DMARC only takes effect at `_dmarc.outdoorequipped.com`, so no policy is in force.
- SMTP login to SendGrid failed intermittently with `451 Authentication failed` after it had worked. The likely cause is the account's IP allow-list. A password reset through the running app succeeded, so delivery works at least part of the time.

## Decision

Replace the plain emails with one branded HTML template, `server/src/services/emailTemplates.ts`, used for both signup confirmation and password reset.

- A table-based layout with inline styles, 520px wide, with the app palette: red `#de283b`, teal `#005461` and neutral grays.
- The official logo, `public/apple-touch-icon.png` (same artwork as `public/logo.svg`), is attached inline by content ID. Email clients cannot render SVG, an inline attachment works from localhost, and it needs no public image URL. If the file is missing, the email shows a red "A" tile instead.
- Each email greets the person by first name and shows the code in a large boxed monospace block. It states the 10-minute, single-use expiry, tells the person never to share the code, and says what to do if they did not make the request. A plain-text alternative is always sent.
- User-supplied names are HTML-escaped. The code is digits only.
- The preheader text does not include the code, so it does not show on lock screens.
- `pnpm mail:verify <address> [signup|reset]` sends the real template with a sample code and a `[Test]` subject prefix.

Fixing sender authentication is **deferred** at the owner's request. It is not part of this change.

## Alternatives Considered

- Hosting the logo at a public URL. Rejected because it breaks on localhost and in clients that block remote images by default.
- Embedding the logo as base64 in the HTML. Rejected because Gmail strips data URIs in images.
- A templating library or MJML. Rejected because there are only two emails and no build step for them.
- Putting the code in the preheader. Rejected because it exposes the code in inbox previews.

## Consequences

- Until the domain is authenticated on the SendGrid account that owns the key, messages are likely to keep landing in spam. The follow-up is:
  - Authenticate `outdoorequipped.com` in that account. The default `s1`/`s2` DKIM names are already used by the other account, so choose a custom selector or retire the old records.
  - Turn on the custom return path.
  - Move the DMARC record to `_dmarc.outdoorequipped.com`.
- The logo is read from `public/` relative to the server code. The server must run from a checkout or deployment that still contains `public/`.
- Email clients differ, so the layout is built for broad support and has not been checked in every client.
- The intermittent `451` still needs a stable IP allow-list entry, or signup and reset emails will sometimes fail with "Could not send the email".
