# Expected availability includes a time

**Date:** 2026-10-09
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-09-pre-order-deadline-local-time.md](2026-10-09-pre-order-deadline-local-time.md) stores the order deadline as a local date and time, and the expected availability as a local calendar date at midnight. The deadline has to fall before that midnight, so the two fields cannot share a calendar day even when the close time is earlier than when the goods are expected.

## Decision

Expected availability is a local date and time, the same kind of value as the order deadline. The manager picks both on the create, edit, and relist forms.

The deadline must be strictly earlier than the expected availability instant. The same calendar day is allowed when the close time is before the expected time. An empty expected availability stays optional.

The Pre-Orders table and the storefront show the expected availability with its time, in the viewer's local clock.

## Alternatives Considered

- **Keep the date-only field and allow any deadline on that day.** Rejected: a close time after the goods are expected would still be accepted.
- **Require the deadline to be on an earlier calendar day.** Rejected: that is the restriction this change removes.

## Consequences

- An expected availability saved earlier as a date is stored at local midnight. Editing it shows that midnight until the manager sets a time.
- The comparison is still an instant check. Equal times are not allowed; the deadline has to be before the expected time.
