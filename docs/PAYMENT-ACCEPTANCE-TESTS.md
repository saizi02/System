# Paynow test mode — functional acceptance tests

Use a local or approved staging database, Paynow test mode, and a Paynow test merchant account—not live business data. Configure `PAYMENT_PROVIDER=paynow` and follow [PAYNOW.md](PAYNOW.md) before testing. Paynow's test numbers and "Faked Success" option do not move real money.

1. **EcoCash success:** Add an item, choose EcoCash, and use Paynow's `0771111111` test number. Approve the phone prompt. Confirm the receipt becomes PAID, stock decreases once, and the order method is `ecocash`.
2. **EcoCash delayed/cancelled/declined:** Repeat with `0772222222`, `0773333333`, and `0774444444` respectively. Confirm pending payments stay pending; cancelled/failed payments release the reservation and do not produce a paid receipt.
3. **Card success:** Choose Card, continue to Paynow, sign in with the configured test email, then select **TESTING: Faked Success**. Confirm one paid order, the expected price/currency, and one stock change.
4. **Card cancellation/failure:** Cancel or decline on Paynow's page. Confirm the order does not become paid, reserved stock is released, and the customer can retry.
5. **Cash pending:** Choose Cash. Confirm a pending-cash order is created and stock is unchanged; the customer receipt says Awaiting Cashier.
6. **Cashier confirmation:** Sign in as authorised Cashier; open Cash payment queue; click Confirm cash; verify item quantities/total in the review dialog; confirm demo cash received. Confirm the existing order moves to PAID and stock decreases once.
7. **Cashier rejected cancellation:** Cancel a pending cash order in Cashier workspace; confirm it becomes CANCELLED and does not decrement stock.
8. **Duplicate request:** Rapidly tap checkout and retry with the same idempotency key after network interruption. Confirm no duplicate paid order or double stock deduction.
9. **Offline:** Disconnect the kiosk or mobile device. Confirm that the checkout button is disabled and no payment status is marked paid. Reconnect and checkout normally.
10. **Receipt printing:** Select the installed thermal printer and use 80 mm format. Verify Paynow reference and paid status are correct, and check grocery exit QR, food ticket, and fashion pickup receipt. Browser-print availability does not establish unattended printing support.

If a test fails, record the expected/actual result and fix it before declaring the final-year system ready for demonstration.
