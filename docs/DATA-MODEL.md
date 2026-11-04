# PostgreSQL Data Model

The source of truth is the numbered files in `server/sql/` (`001_initial.sql`, `002_roles_kitchen.sql`), applied once each by `npm run db:migrate`. Tables:

- `businesses`: each grocery / food / clothing shop with status, selected currency and FX rate snapshot source.
- `branches`: one or more checkout locations per store.
- `staff`: secure bcrypt password hash; role `super_admin` (Super Admin), `business_admin` (General Admin), `cashier` or `kitchen`; optional store/branch scope; `must_change_password`, `last_login_at`, `created_by`.
- `sessions`: opaque token hash, guest identity and staff identity with expiry; tokens sent in HttpOnly cookies.
- `products`: store catalog, integer-cent USD price, barcode, product photo URL and named variants.
- `inventory`: store+branch+product+variant primary key with nonnegative integer quantity. No fractional weight values.
- `orders`: idempotent unique customer/key, frozen order lines, currency/rate snapshot, simulated outcome, status, fulfillment and exit verification.
- `cart_transfers`: random one-time codes, expiry, consumed flag.
- `shopping_sessions`, `flags`: operational visibility and reconciliation.
- `audit_logs`: who did what and when — sign-ins, account creation/disable/password reset, cash confirmations and every kitchen/handover step. Shown in the Admin console's *Activity log*.

Approved simulated EcoCash/card checkouts lock inventory records before deduction; declined ones do not deduct stock. Cash orders remain pending until staff confirms them with stock locks and quantity revalidation.

**Only simulated payment gateway communication**; product and transaction records are persisted in real PostgreSQL tables.
