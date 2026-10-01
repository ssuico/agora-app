# Hybrid accounts and view switching

**Date:** 2026-10-02
**Status:** accepted
**Author:** collaborative

## Context

A user has one `role`. Someone who runs a store and also shops, or an admin who wants to see the store manager or customer screens, needs a second account today. Related: [2026-10-01-customer-self-signup.md](./2026-10-01-customer-self-signup.md) keeps public signup customer-only, and [2026-10-02-admin-password-reset.md](./2026-10-02-admin-password-reset.md) notes that sessions are stateless JWTs.

## Decision

**Data.** `User.role` stays and becomes the default view. A new `User.roles` array holds every role the account may use. A helper treats a missing `roles` as `[role]`, so existing accounts need no migration, and `role` is always included in the granted set.

**Who can grant.** Only admins. `PATCH /api/users/:id` already requires an admin. It now accepts `roles`. Public signup still forces `[customer]`. An admin cannot remove admin access from their own account.

**Session.** The JWT carries `role` (the active view) and `roles` (all granted). Every existing check, on the API (`authorize`) and in the Astro middleware, keeps reading `role`, so each view only has the powers of that role. A hybrid admin who switches to the customer view cannot call admin endpoints until switching back.

**Switching.** `POST /api/auth/switch-role` takes `{ role }`, reloads the user from the database, requires the role to be granted there, and issues a fresh cookie with that active role. A revoked role can no longer be switched to. The top bar shows a "Switch view" group when an account has more than one role. After switching the app goes to `/`, which already routes by role.

**Lookups.** Listing users by role (store manager pickers, customer pickers, dashboard counts) matches any granted role, so a hybrid account shows up in each.

**Admin screen.** The edit dialog gets role checkboxes and a default-view select limited to the checked roles. The table shows one badge per role.

## Alternatives Considered

- Merge permissions: a hybrid admin and customer keeps admin power in every view. Rejected because the point of a view is to see what that role sees.
- Store the active view in the database. Rejected because it is per browser session, and two tabs should not fight.
- Separate accounts per role. This is the current workaround; it needs two emails and two passwords.

## Consequences

- A token already issued keeps its roles until it expires. Removing a role stops new switches at once but does not end a session already in that view.
- Store manager access still depends on store assignments, set on the Stores page. A user with the role but no stores sees the "no stores" screen.
- Create-user stays single-role; extra roles are granted from the edit dialog.
