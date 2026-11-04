# SSTWAS 2.0 — acceptance checklist (not yet completed)

- [ ] `npm install` and `npm --prefix server install` complete on user's computer.
- [ ] `npm test` passes; `npm run build` completes successfully.
- [ ] PostgreSQL migrations 001 and 002 complete (re-running reports "up to date"); Super Admin bootstrap works once, not twice.
- [ ] Super Admin can sign in, create grocery/food/clothing stores and create Super Admin, General Admin, Cashier and Kitchen accounts with a chosen password.
- [ ] Weak passwords and mismatched confirmations are rejected; "require change at first sign-in" forces the change screen.
- [ ] General Admin sees only their store, can create Cashier/Kitchen accounts for it, but cannot register stores, create admins or open other stores' data.
- [ ] Role permissions prevent Cashier from creating stores and cross-store edits.
- [ ] Each station's own sign-in (`/admin`, `/cashier`, `/kitchen`) refuses accounts of other roles.
- [ ] Food order: appears on Kitchen display after payment; Kitchen can mark Preparing/Ready but not Collected; Cashier station is notified and marks Collected.
- [ ] Disabling an account ends its session immediately; the last active Super Admin cannot be disabled.
- [ ] Admin → Kiosk devices: a kiosk can be registered, paired on a second device with its one-time code (code fails on reuse), shows Online/Customer shopping/Customer paying in Admin and on the Cashier overview, and goes Offline when the tablet is closed.
- [ ] Maintenance mode shows an out-of-service screen on the tablet; Unpair returns it to the setup screen; a kiosk cash order shows "Kiosk · name" in the Cashier cash queue.
- [ ] Activity log records sign-ins, account changes, cash confirmations and order status steps.
- [ ] Products, variant-specific stock and store settings persist on refresh.
- [ ] Grocery kiosk and mobile scanning, handheld barcode scanner (keyboard and serial modes) and camera scanning on the kiosk, barcode validation and duplicate blocking in Admin, phone checkout (cash goes to the cashier) and offline draft work.
- [ ] Simulated EcoCash/card approved checkout deducts stock once; decline does not.
- [ ] Pending cash only deducts once the Cashier confirms; cancellation leaves stock unchanged.
- [ ] One-time grocery exit QR rejects repeat scanning and records a flag.
- [ ] Food orders can move New → Preparing → Ready → Collected.
- [ ] Fashion product variants and pickup queue work.
- [ ] Currency rates snapshot correctly at checkout and receipt displays them.
- [ ] Products and orders are isolated across businesses/branches; attempts to fake paid status are rejected.
- [ ] Two simultaneous customers cannot buy more than remaining stock; duplicate idempotency keys do not duplicate orders.
- [ ] Chrome PWA installation works; camera scanning on mobile requires HTTPS or localhost.
- [ ] Print 80 mm receipt on target thermal printer; demo watermark appears.
- [ ] PostgreSQL backup/restore process, SSL/HTTPS, database access permissions, origin/CORS policy and error logging are tested before deployment.

Unchecked tests represent **unverified functionality**. Backend unit tests alone do not certify the complete system.
