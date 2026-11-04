# SSTWAS 2.0 — Agreed final scope

This file resolves the earlier operations document against the latest confirmed decisions.

## Product
One PostgreSQL-backed, installable React PWA with a customer app and three stand-alone staff dashboards (each with its own address and sign-in):

- Customer: mobile web/PWA and an independent touchscreen kiosk (guest users, no phone required).
- Cashier station (`/cashier`): confirmation of simulated cash, handover of ready food orders, clothing pickup, grocery exit verification.
- Kitchen display (`/kitchen`): live food-preparation board (New → Preparing → Ready) that notifies the Cashier.
- Admin console (`/admin`): products, barcodes, QR generation, stock, user accounts, shop settings, sales reports, activity log. The **Super Admin** performs all General Admin duties for every store and **creates and manages every account type** (including other Super Admins and General Admins). A **General Admin** manages one store and its Cashier and Kitchen accounts.

## Business profiles
- Grocery/supermarket: phone barcode camera Scan & Go; searchable kiosk product catalogue; phone checkout (finished on the phone; cash is confirmed by the cashier) or kiosk checkout with handheld/camera barcode scanning; single-use paid-exit receipt QR.
- Food/fast-food outlet: menu, item selection, special instructions, dine-in/takeaway, payment, kitchen ticket, pickup queue.
- Fashion/clothing: product browsing, variant-specific colour/size stock, payment, receipt and pickup slip.

**Weighing scales, loose-produce weight-based pricing and bagging-station weight verification have been REMOVED.** No scale or weighing device is required or included in this project. An optional dedicated grocery barcode reader is not necessary; smartphone camera scanning and kiosk touch-selection are supported.

## Real operations vs simulated operations
All non-payment operations must use the authoritative backend: PostgreSQL for businesses, catalogue, stock, carts/transfers, orders and reports, Express for validated writes and atomic inventory changes, and server-managed staff sessions. Price/stock cannot be trusted to the customer browser.

**Only actual payment-provider communication is simulated.**
- EcoCash-style flow: example number, sending a demo prompt, manual demo approval or decline. Does not contact EcoCash or charge a phone.
- Card-style flow: fictional virtual card, demo authorisation or decline. Does not solicit actual card credentials or communicate with a card network.
- Cash: create a pending order; staff reviews the order and confirms a simulated cash receipt in the Cashier module. Confirmation makes the order paid and deducts stock.
- All payment screens and printed receipts must say **SIMULATED / NO REAL MONEY**.
- Failed digital simulations must not reduce inventory or produce a valid paid receipt. Pending cash must never be treated as paid before Cashier confirmation.

## Printing and offline use
Digital receipts and printable 80 mm thermal receipt styling are included. The target printer model, driver, connectivity, paper size and auto-print bridge must be tested and configured on site. The browser print dialog is the current supported printing mechanism; silent printing is **not** implemented.

Offline customers may browse cached products and save a draft cart. Checkout, authoritative stock updates, payment approval, kitchen state and exit verification require an authenticated backend connection. This is intentional protection against accidental duplicate or oversold transactions.

## Release gate
This project is not deemed completed until `npm run build`, role-based API authorization, end-to-end PostgreSQL/Express tests, multi-device checkout, PWA installation and thermal printer printing have been verified on the user's environment. Do not mistake a successful unit test for a production acceptance test.
