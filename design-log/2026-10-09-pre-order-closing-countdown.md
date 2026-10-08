# Pre-order storefront closing countdown

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

The storefront lists each pre-order's order deadline as a date and time. A customer has to compare that clock with the current time to know how long ordering stays open.

## Decision

Each pre-order card on the storefront shows a countdown to `preOrderClosesAt`, in the viewer's local clock. The same countdown appears in the Pre-Order Now dialog.

The countdown updates every second. It shows days, hours, and minutes while a day or more remains, and includes seconds once it is under a day. Under one hour the countdown uses the warning color. When the deadline passes, the card shows that ordering has ended and Pre-Order Now stays disabled.

A pre-order with no deadline has no countdown. A listing the manager closed does not show a countdown.

## Alternatives Considered

- **Show only the deadline and let the customer calculate the remainder.** Rejected: the remaining time is the thing customers need while they decide.
- **Update once a minute.** Rejected: the last hour should move in seconds so the close is obvious.

## Consequences

- The pre-order catalog re-renders once a second while that tab is showing, so the button disables as the countdown reaches zero.
- The rest of the shop does not tick every second. The dialog ticks only while it is open.
