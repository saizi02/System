# Paynow payments (Zimbabwe)

Paynow replaces the demo EcoCash, card and bank screens. Customers can pay by **EcoCash**, **OneMoney** (phone prompt) or **card** (Visa, Mastercard, ZimSwitch on Paynow's secure page), or by **cash** at the cashier as before.

## 1. Get your Paynow details
In your Paynow merchant account create an integration ("3rd party site or link profile") and note:
- **Integration ID** (a number)
- **Integration Key**
- The **email you sign in to Paynow with**. In test mode Paynow only fakes payments for this email.
- The **currency** of the integration (USD or ZWG). Online payments in the till are taken in that one currency.

## 2. Set the environment variables (`server/.env`, or Render / docker settings)
```
PAYMENT_PROVIDER=paynow
PAYNOW_INTEGRATION_ID=1234
PAYNOW_INTEGRATION_KEY=your-integration-key
PAYNOW_AUTH_EMAIL=you@yourshop.co.zw
PAYNOW_MODE=test        # change to live when you are ready to take real money
PAYNOW_CURRENCY=USD
PAYNOW_EXPIRY_MINUTES=10
```
Restart the API. The start-up line should say `payments=paynow`. If a value is missing the server stops with a message saying which one.
The key stays on the server. It is never sent to the browser.

## 3. Test mode (no real money)
- **EcoCash / OneMoney:** choose EcoCash, enter `0771111111` (succeeds after about 5 seconds), `0772222222` (succeeds after 30 seconds), `0773333333` (cancelled after 30 seconds) or `0774444444` (fails at once: insufficient balance).
- **Card:** you are sent to Paynow's page. Choose **"TESTING: Faked Success"** and press Make Payment.
- Sign in to Paynow with the same email you set as `PAYNOW_AUTH_EMAIL`.

## 4. Going live
1. Ask Paynow to approve your integration for live payments and confirm the currency.
2. Set `PAYNOW_MODE=live` and use the live integration ID and key.
3. Your site must be reachable on the internet over **https** (set `APP_ORIGIN`), so Paynow can post payment results to `https://YOUR-DOMAIN/api/payments/paynow/result`. On a laptop (localhost) payments still complete, because the till also asks Paynow for the status itself, just a few seconds slower.

## 5. How it works
1. The customer pays. The order is saved as **awaiting payment** and its stock is **reserved**.
2. The server asks Paynow to start the payment (phone prompt, or a redirect for card).
3. Paynow reports the result to `/api/payments/paynow/result`. The server checks the signature (SHA-512 with your key) and then asks Paynow directly before it changes the order.
4. **Paid:** the order becomes paid, gets its pay number, and shows on the kitchen screen and reports.
   **Cancelled, declined or timed out (default 10 minutes):** the order becomes failed and the stock is returned automatically.
5. The customer's receipt page updates by itself. A safety check every 30 seconds also confirms any order still waiting.

## 6. Things to know
- **Refunds.** Refunding an order in the till returns the stock and records the reason, but the **money is returned from the Paynow dashboard**. The API here does not move money back.
- **Amounts.** The amount Paynow reports must equal the order total. If not, the order is not marked paid and the mismatch is written to the audit log.
- **Currency.** When Paynow is on, choosing EcoCash, OneMoney or card switches the basket to `PAYNOW_CURRENCY`. Cash can still be taken in any currency.
- **Demo screens** are used only when `PAYMENT_PROVIDER=simulated` (development). With `paynow` they are never shown.
- Settlement of funds to your bank follows Paynow's normal settlement schedule.
