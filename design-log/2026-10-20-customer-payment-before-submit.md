# Customer chooses cash or QR before submitting an order

**Date:** 2026-10-20
**Status:** accepted
**Author:** collaborative

## Context

[2026-10-20-pos-enhancements.md](./2026-10-20-pos-enhancements.md) added cash and bank/QR on the staff transaction screen, and left customer checkout as a reservation with no payment method. A customer who orders from the shop is never asked how they will pay.

## Decision

A customer chooses a payment method before a shop order or a pre-order is created.

- **Pay in person (cash).** The order is created unpaid with `paymentMethod: cash`. The customer pays cash when they claim it.
- **Pay now by QR or bank.** The store's active QR codes are shown. The order is created only after the customer enters the last 4 digits of the payment reference. The order stays unpaid with `paymentMethod: bank_qr`, which the counter already shows as Pending Payment. The QR option and those digits are stored for review.

The store manager confirms the last 4 digits match the payment they received. That confirmation marks the order paid. Both the Pending Payment badge and Mark as paid open that review when the order already has a QR reference. Mark as paid still asks for cash or bank/QR only when the order has no method yet. A QR order with no digits continues the QR payment instead of asking again. A customer cannot mark their own order paid.

The shop sends `placedFrom: 'shop'`. That checkout uses these customer rules even when the signed-in account is also an admin or store manager, and the order is a reservation in that person's name. The counter still sends `paymentStatus` and keeps staff cash as paid immediately.

Staff cash is unchanged: money taken at the counter still marks the order paid.

## Alternatives Considered

- Leave QR as a separate "Scan to Pay" viewer and still submit the order with no method. The customer asked for the choice before submit.
- Mark the order paid as soon as the customer enters the digits. The store still has to check that those digits match the payment they received.

## Consequences

- Orders placed before this change still have no payment method.
- A customer QR payment waits in Pending Payment until a manager confirms the stored digits.
