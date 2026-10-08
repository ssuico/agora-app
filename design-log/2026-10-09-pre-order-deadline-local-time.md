# Pre-order deadline uses the manager's local time

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-09-pre-order-listing-cutoff-and-closed-store.md](2026-10-09-pre-order-listing-cutoff-and-closed-store.md) stored the order deadline and expected availability date on the Eastern clock. Setting those fields that way does not match the clock the manager is using when they create a pre-order.

## Decision

Create, edit, and relist read the deadline and the expected availability date in the browser's local time.

The date and time inputs stay as the browser provides them. Before submit, the client turns the deadline into a UTC instant and the expected date into local midnight on that calendar day, then sends those ISO instants. The server stores them as given. A deadline still has to be in the future on create and relist, and still has to fall before the start of the expected date when one is set.

The Pre-Orders table and the storefront show those two values in the viewer's local time, without an EST label.

## Alternatives Considered

- **Keep sending the wall-clock string and interpret it as Eastern on the server.** Rejected: the manager's picker is a local clock, so Eastern conversion shifts the deadline away from the time they chose.
- **Send a timezone name and convert on the server.** Rejected: the browser already knows the local offset. An ISO instant is enough.

## Consequences

- A deadline saved earlier as Eastern still displays as that same instant, converted into the current local clock.
- Listing history timestamps and order dates stay on the Eastern clock used by the rest of Agora.
