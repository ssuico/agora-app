# Use shadcn components across the client UI

**Date:** 2026-10-01
**Status:** accepted
**Author:** collaborative

## Context

shadcn is configured (`components.json`, radix base, `new-york`, Tailwind v4) but most screens hand-rolled their own cards, status pills, error boxes, empty states, spinners, tables, selects and inputs. `Card` was barely used because it hard-coded `bg-white/70 border-white/45`, which is unreadable in the dark default from [dark-default-theme](2026-10-01-dark-default-theme.md). The semantic tokens from [frozen-mist-palette](2026-10-01-frozen-mist-palette.md) were already correct, so only the component needed fixing.

## Decision

- `Card` now uses `bg-card border text-card-foreground shadow-sm`, so it follows both themes through the tokens.
- Added from the shadcn registry: `alert`, `alert-dialog`, `checkbox`, `empty`, `field`, `progress`, `scroll-area`, `spinner`, `textarea`.
- `Badge` gains `success`, `warning` and `info` variants so status colors live in one component instead of per-screen class strings.
- Screens are refactored to use `Card` composition, `Badge`, `Alert`, `Empty`, `Skeleton`, `Spinner`, `Separator`, `Table`, `Select`, `Input`, `Textarea`, `Checkbox`, `Field` and `AlertDialog` where they replace hand-rolled markup.
- Pure presentation change: no data, state, route or copy changes. Customized `button`, `label` and `separator` were kept as they are (the CLI would have overwritten them); `react-hot-toast` stays instead of moving to Sonner.
- Tables inside `.data-table-scroll-wrapper` (sticky headers) stay raw, because `Table` wraps itself in its own scroll container.

## Alternatives Considered

- Overwriting `button`/`label`/`separator` with registry versions. Rejected: loses the project's gradient button styling.
- Moving toasts to Sonner as the skill recommends for Radix. Deferred: separate change touching every screen's error handling.
- Leaving `Card` as is and styling around it. Rejected: it was the reason cards were hand-rolled.

## Consequences

- Cards look slightly flatter than the old translucent glass treatment; `app-surface`/`product-card-surface` classes remain available where a screen needs it.
- The CLI added an unrelated `cn` npm package while installing; it was removed and the new files import `@/lib/utils`.
- Follow-up: Sonner migration; `InputGroup`/`ToggleGroup` where password toggles and option sets exist.
- Behavior differences from the swap: delete/cancel confirmations in the admin managers and `TransactionManager` are now `AlertDialog` (outside click no longer dismisses; the action still closes only after the request succeeds). `ProductManager` confirmations stay `Dialog` so the "Deleting..." state remains visible. The claim, payment and customer-type segmented toggles in `TransactionManager` are `Tabs`.
- Tables inside `.data-table-scroll-wrapper` stay raw `<table>` (sticky headers). Remaining deliberate raw spots: carousel dots, star pickers, rank circles, the stock-flash overlay, the hidden QR file input.
- Verified with `tsc` (no errors under `src/`) and `astro build`. Not checked in a browser; a visual pass in both themes is still needed.
- Login page was simplified at the same time: `AuthShell` `kicker`, `headline` and `notices` are optional, and login passes only a short `lede`.
