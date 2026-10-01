# Agora POS color system and removal of the dark theme

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

The product palette in [2026-10-01-frozen-mist-palette.md](./2026-10-01-frozen-mist-palette.md) (orange on cream) and the dark default in [2026-10-01-dark-default-theme.md](./2026-10-01-dark-default-theme.md) are superseded. The request is a POS-oriented system: red for actions, teal for operational context, a neutral structure, and no dark theme for now. The color part of the frozen-mist entry and the whole dark-default entry no longer hold. The auth board layout from [2026-10-01-auth-stall-board.md](./2026-10-01-auth-stall-board.md) still holds, in neutral colors.

Audit before the change (`src/`):

- 7 files with hardcoded hex (`Toaster`, `DashboardCharts`, `Topbar`, `ShopView`, theme files, `chart.tsx`). `Toaster` also wrapped hex variables in `hsl(var(...))`, which is invalid and made default toasts fall back to library colors.
- Tailwind palette classes (`green`, `amber`, `red`, `blue`, `emerald`, `yellow`, `violet`, `pink`, `slate`, ...) in 17 files, mostly status and rating meaning, plus 8 hue-rotating avatar colors in `ActivityFeed`.
- `primary` used for decoration (prices, section icons, restock/sold counts, store chips) as well as for actions.
- Gradients and orange-tinted shadows on buttons, inputs, surfaces, and the page background.
- shadcn `accent` used only as a neutral hover/selected surface.

## Decision

**Tokens.** The ten base tokens from the request are added to `:root` unchanged (`--primary-100` ... `--bg-300`). The existing shadcn variables (`--primary`, `--background`, `--border`, ...) become the semantic layer and point at the base tokens, so every component that already reads them follows without a find-and-replace.

| Role | Token | Value |
|------|-------|-------|
| Action | `--primary` | `primary-100` |
| Action hover | `--primary-hover` | `primary-100` mixed 15% black |
| Soft selected | `--primary-subtle` | `primary-300` |
| Operational | `--operational` (+ `-foreground`, `-soft`, `-subtle`) | `accent-200`, white, `accent-100`, 14% `accent-100` on white |
| Text | `--foreground` / `--muted-foreground` | `text-100` / `text-200` |
| Surfaces | `--background`, `--card` / `--muted`, `--canvas` | `bg-100` / `bg-200` |
| Border | `--border` | `bg-300` |
| Input border | `--input` | `bg-300` mixed 50% with `text-200` |
| Focus | `--ring` | `primary-100` |
| Status | `--success`, `--warning`, `--error`, `--info` (+ `-soft`, `-ink`) | see below |
| Ratings | `--rating` | star amber, graphics only |

**`accent` stays neutral.** shadcn's `accent` drives hover rows, dropdown focus, ghost hover, and skeletons. Mapping it to teal would turn every hover surface teal. `--accent` is `bg-200`; teal is a separate `--operational` family.

**Contrast adaptations** (computed, WCAG relative luminance):

- White on `primary-100`: 4.70:1, passes. Used for the primary button.
- White on `primary-200`: 2.91:1, fails. Primary button hover is `primary-100` darkened 15% (`#BD2232`, 6.11:1) instead. `primary-200` is used where no text sits on it: hover borders, chart series, soft emphasis.
- White on `accent-100`: 2.59:1, fails. `accent-100` carries dark text (`text-100`, 6.73:1) or is used as a graphic/tint.
- White on `accent-200`: 8.60:1. Used for operational buttons and the active operational states.
- `primary-100` on `primary-300`: 3.28:1. Active nav uses `text-100` for the label and `primary-100` for icon and indicator only.
- `bg-300` as an input border is 1.61:1, under the 3:1 needed to identify a control. Inputs use `--input`; dividers and card borders keep `bg-300`.

**Status colors are separate from the brand red.** Success `#15803D`, warning `#B45309`, error `#B42318` (deeper than the brand red so "Delete" and "Complete Sale" are not the same swatch), info is `accent-200`. Each has a `-soft` background and an `-ink` text color checked at 7.5:1 or better. Status is always paired with an icon or label in the components touched.

**Surfaces.** Page canvas is `bg-200`, cards and the shell are `bg-100` with `bg-300` borders. Body gradients, orbs, backdrop blur, zebra rows, and orange-tinted shadows are removed. Tables: header `bg-200`, body `bg-100`, hover `bg-200`.

**Navigation.** Default `text-200`, hover `bg-200`, active `primary-300` background with a `primary-100` indicator bar and icon, semibold label.

**Buttons.** `default` is flat `primary-100`; `outline` is `bg-100` with the input border and `bg-200` hover; new `accent` variant is `accent-200` for operational actions; `destructive` uses `--error`.

**Auth board.** The orange field is a large saturated surface, so it becomes a neutral `bg-200` panel with a `primary-100` wordmark and rule.

**Dark theme removed.** `.dark` token block, `ThemeBoot`, `ThemeToggle`, `class="dark"` on every layout, and `dark:` utilities are deleted. `@custom-variant dark` stays pointed at `.dark` so any leftover `dark:` class stays inert instead of following the OS setting. Chart `THEMES` config in `chart.tsx` is the stock shadcn shape and is left alone.

**Charts.** `--chart-1..5` are red, deep teal, light teal, soft red, gray. `--chart-6..10` are palette-derived mixes for charts with many series. Revenue is red and profit is teal. Star distribution uses error, warning, rating, light success, success. Stock bars use error, warning, and operational (in stock). Perishable is warning and non-perishable is operational.

## Alternatives Considered

- Map shadcn `--accent` to teal. Rejected: hover and focus surfaces everywhere would become teal.
- Use `primary-200` as the primary hover with white text, as written in the request. Rejected on contrast (2.91:1); the request says accessibility wins.
- Auth board in `accent-200`. Rejected: a large teal block competes with the red action on the form.
- A single global find-and-replace of orange to red. Rejected by the request; status, rating, and chart colors carry their own meaning.

## Consequences

- The login form, shell, store, customer, and admin screens change together, because they share tokens.
- The customer shop product price changes from brand color to neutral text; red stays on actions, so the add-to-cart button is the only red in a product card.
- Charts use a restrained set built from the palette plus the status tokens for stock and star ratings.
- `localStorage` key `agora-theme` is no longer read. Existing values are ignored.
- Bringing dark back later means adding a `.dark` token block and a toggle; no component hardcodes light colors after this change.
