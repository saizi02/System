# Payment simulation — functional acceptance tests

Use the LOCAL PostgreSQL database or your approved staging PostgreSQL project, not live business production data. All of these tests use real backend order records with simulated payment outcomes.

1. **EcoCash-style success:** Add a grocery product to cart; choose EcoCash; review demo mobile number; click Send simulated request; click Approve demo prompt. Confirm receipt is PAID, stock decreased by exactly purchased quantity, order has `paymentSimulated=true` and `method=ecocash`.
2. **EcoCash-style decline:** Repeat with a new cart; decline the demo prompt. Confirm the order is FAILED, no inventory changes and there is no paid-exit receipt.
3. **Card-style success:** Choose Card, present the fictional test card and authorise. Confirm one paid order, accurate price/currency snapshot and one stock change. No card number, PIN, CVV, or real transaction is collected.
4. **Card-style decline:** Click Decline simulated payment. Confirm failed order is recorded, stock is unchanged and user is offered a retry.
5. **Cash pending:** Choose Cash. Confirm pending-cash order is created and stock is unchanged; customer receipt says Awaiting Cashier.
6. **Cashier confirmation:** Sign in as authorised Cashier; open Cash payment queue; click Confirm cash; verify item quantities/total in the review dialog; confirm demo cash received. Confirm the existing order moves to PAID and stock decreases once.
7. **Cashier rejected cancellation:** Cancel a pending cash order in Cashier workspace; confirm it becomes CANCELLED and does not decrement stock.
8. **Duplicate request:** Rapidly tap checkout and retry with the same idempotency key after network interruption. Confirm no duplicate paid order or double stock deduction.
9. **Offline:** Disconnect the kiosk or mobile device. Confirm that the checkout button is disabled and no payment status is marked paid. Reconnect and checkout normally.
10. **Receipt printing:** Select the installed thermal printer, use 80 mm format and verify that DEMO / NO REAL PAYMENT is visible. Check grocery exit QR, food ticket, and fashion pickup receipt. Browser-print availability does not establish unattended printing support.

If a test fails, record the expected/actual result and fix it before declaring the final-year system ready for demonstration.
