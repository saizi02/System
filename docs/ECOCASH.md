# Direct EcoCash Online Payments

The till can send EcoCash payment requests directly to EcoCash Online Payments. This is separate from Paynow and from the general EcoCash EPG sandbox APIs. The customer uses an EcoCash phone prompt; cash remains available as a fallback.

## 1. Request the right sandbox access

In the EcoCash Developer Portal, request **Sandbox → Instant Payments / Online Payments** access and obtain the Online Payments username and password. This integration uses HTTP Basic authentication; credentials for the separate EPG service-request API do not work here.

The Online Payments API uses HTTP Basic authentication and also requires the merchant settings listed below. Do not send credentials or merchant PINs in chat, frontend variables, or source control.

Official docs:
- [EcoCash Online Payments](https://developers.ecocash.co.zw/docs/online-payments)
- [EcoCash Developer Portal](https://developers.ecocash.co.zw)

## 2. Configure the server

Set these in `server/.env` or the deployment's secret environment:

```env
PAYMENT_PROVIDER=ecocash
ECOCASH_MODE=sandbox
ECOCASH_API_BASE_URL=https://developers.ecocash.co.zw/sandbox/payment/v1
ECOCASH_USERNAME=
ECOCASH_PASSWORD=
ECOCASH_MERCHANT_CODE=
ECOCASH_MERCHANT_PIN=
ECOCASH_MERCHANT_NUMBER=
ECOCASH_TERMINAL_ID=
ECOCASH_LOCATION=
ECOCASH_MERCHANT_NAME=
ECOCASH_SUPER_MERCHANT_NAME=
ECOCASH_CURRENCY=USD
ECOCASH_EXPIRY_MINUTES=10
```

`ECOCASH_API_BASE_URL` defaults to the published sandbox base URL. EcoCash supplies the production endpoint after approval; set that exact HTTPS base URL before switching `ECOCASH_MODE=live`. The API username/password, merchant PIN, and other merchant settings stay on the server.

Set these values in `server/.env` for local testing, or in your deployment's secret environment. Never put them in the frontend or commit them. Restart the API and check `/api/health`; its `payments` field should be `ecocash`. Online checkout is locked to the configured currency. The till's `ZIG` setting is sent as EcoCash's `ZWG` currency code.

EcoCash initiates the charge and the till checks its status using the customer's number and transaction correlator. The customer's normalized number is stored only while the payment is pending and is cleared when the payment settles or expires. A timeout is not retried as a new charge; the till checks the original transaction instead.

## 3. Sandbox test

Whitelist the test customer number in the developer portal. Start with a low-value order and use the test merchant PIN per EcoCash's sandbox instructions: `0000` simulates success, `1111` insufficient funds, `2222` an incorrect PIN, and `9999` a limit breach. These are server-side sandbox test values, not the customer's PIN. No real money moves in sandbox.

Confirm that success marks the receipt paid and reduces stock once. Verify rejected payments release reserved stock. An order with an unconfirmed response is looked up rather than charged again; expiry releases stock only after EcoCash successfully reports that the transaction is still pending. If lookup is unavailable, the order remains pending until its status can be confirmed.

## 4. Go live

Complete EcoCash's sandbox test script and request production access. Configure the production username/password and merchant settings, use the production API base URL EcoCash provides, set `ECOCASH_MODE=live`, and use the approved currency. Do not enable live mode until EcoCash has approved the integration.

The server checks transaction status using the Online Payments lookup API. An ambiguous timeout is kept pending and is not retried automatically, to avoid creating a second charge.

## 5. Notes

- Refunds are still recorded in the till and restore stock, but the money movement must be made through EcoCash separately.
- OneMoney, card, and bank payments are not enabled by the direct EcoCash provider. Paynow remains available as a separate provider if explicitly configured.
- The till stores the customer's normalized EcoCash number only while payment is pending so it can perform status lookup; it clears that value once the order settles or expires.
