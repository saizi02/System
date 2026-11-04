# Deploying SSTWAS 2.0 in a real shop

This guide takes the system from "runs on a laptop" to "runs the shop every day". Read **Before you go live** at the end.

## 1. Choose how the stores are set up

| Mode | Setting | Use when |
|---|---|---|
| **One store per installation** | `STORE_MODE=single` | Each shop gets its own server and database. Customers who open the address land straight on that shop. No second store can be created. |
| **Shared server** | `STORE_MODE=shared` (default) | One server hosts several shops (grocery, food, fashion). Each shop is fully isolated: its own General Admin, cashiers, kitchen staff and kiosks only ever see that shop. |

In both modes the chain is the same: **Super Admin → General Admin (one store) → Cashiers and Kitchen staff (one branch) → Kiosks (paired to one branch)**. Nobody can read or change another store's data; this is enforced on the server, not just hidden in the screens.

## 2. Install with Docker (recommended)

You need a server or shop PC with Docker and, for automatic HTTPS, a domain name pointing to it (ports 80 and 443 open).

```
cp deploy/.env.example deploy/.env      # then edit deploy/.env
docker compose --env-file deploy/.env up -d --build
```
Create the first Super Admin once:
```
docker compose --env-file deploy/.env exec -e BOOTSTRAP_ADMIN_EMAIL=owner@myshop.co.zw -e BOOTSTRAP_ADMIN_PASSWORD='A-long-Passw0rd-here' -e BOOTSTRAP_ADMIN_NAME='Shop Owner' app node scripts/bootstrap-admin.js
```
Open `https://<your domain>/admin`, sign in, register the store (single mode: one store only), then create the General Admin, cashiers and kiosks as described in `ROLES-AND-STATIONS.md` and `KIOSK-DEVICES.md`.

What starts: PostgreSQL (data volume), the app (applies new database migrations on every start), Caddy (HTTPS certificates and renewal), and a backup service.

### No public domain (shop network only)
Camera features and "install as app" need HTTPS. Set `DOMAIN=till.local` (any name that resolves on your network) and add `tls internal` inside the site block of `deploy/Caddyfile`. Caddy then issues its own certificate; install Caddy's root certificate (`docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt .`) on each tablet/PC once so the browser trusts it.

## 3. Install without Docker (Windows or Linux)
1. Install Node.js 20+ and PostgreSQL 16+. Create a database and a database user for the app.
2. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL`, `NODE_ENV=production`, `SESSION_SECRET` (32+ random characters), `APP_ORIGIN` (the https address), plus `STORE_MODE` and `STORE_TIMEZONE`.
3. `npm install`, `npm --prefix server install`, `npm run build`, `npm run db:migrate`, `npm run bootstrap:admin`, then `npm run serve`. One process now serves both the API and the web app.
4. Keep it running with a service manager (NSSM or Task Scheduler on Windows, systemd on Linux) and put an HTTPS proxy in front (Caddy is a single file; see `deploy/Caddyfile`).

## 4. Backups and restore
- The backup service takes a backup shortly after start, then every night at `BACKUP_HOUR`, keeping `BACKUP_KEEP_DAYS` days. Files appear in `./backups/` (`sstwas-*.dump` for the database, `uploads-*.tar.gz` for product photos).
- **Copy `./backups/` off the machine** (external drive or cloud folder) at least weekly. A backup on the same disk does not survive a failed disk or a theft.
- Restore: `./deploy/restore.sh backups/sstwas-YYYYMMDD-HHMMSS.dump` (asks for confirmation, replaces all data).
- Test a restore on a spare machine once before you rely on it.
- Without Docker: `pg_dump --format=custom -f backup.dump sstwas` and `pg_restore -d sstwas --no-owner backup.dump`.

## 5. Hardware
- **Kiosk:** tablet or touchscreen PC, set to never sleep, running the installed kiosk app (pair it in Admin, Kiosks). Connect the **barcode scanner** by USB or Bluetooth (see `BARCODE-SCANNER.md`). Grocery kiosks have no camera scanning; the scanner and an on-screen keypad are used.
- **Cashier station:** any PC or tablet with the browser; a **receipt printer** (80 mm) works through the browser print dialog; a USB scanner works for exit verification.
- **Kitchen display:** a screen with the browser open on `/kitchen` (food stores).
- Give the server a fixed address and put it on a UPS if power is unreliable.

## 6. Security checklist (already built in, and what is left to you)
Built in: sign-in lockout after repeated failures, rate limits, HTTP security headers and a content-security policy, HTTPS-only cookies in production, origin checks on every change, admin sessions that expire after idle time, server-side permission checks on every action, audit log, strong password rules, and startup refusal when production settings are weak.
Yours: keep `deploy/.env` private, use unique strong passwords for each staff member, disable accounts of people who leave (Admin, Staff), apply system updates, and keep backups off-site.

## 7. Payments
Payments are **simulated by default**. In production the simulated card and EcoCash options are switched off automatically (they would approve any payment), so customers can pay **cash at the cashier**, which the cashier confirms. For a demonstration set `ALLOW_SIMULATED_PAYMENTS=true`.
To connect a real gateway, add a provider in `server/src/payments.js`: implement `authorize({method,amountMinor,currency,orderRef})` returning `{outcome:'approved'|'declined'|'pending', reference}`, register it in `providers`, and set `PAYMENT_PROVIDER=<name>`. The reference is stored on the order and appears in the sales export. Keep gateway keys in environment variables and have your gateway's webhook confirm payments before you set `approved`. This needs the gateway's own API documentation and a test account; ask your gateway for them.

## 8. Daily operation
- **Cashier:** *End-of-day report* shows takings by payment type and where they were sold, cash still to confirm, best sellers and low stock; print and sign it.
- **General Admin:** *Reports* has the same report for any date plus CSV exports of sales and stock for your accountant.
- **Updating:** replace the project files, run `docker compose --env-file deploy/.env up -d --build`. Migrations apply by themselves; data is kept.
- **Health:** `https://<domain>/api/health` returns `ok` when the database is reachable. Logs: `docker compose logs -f app`.

## Before you go live
1. Do a full dress rehearsal: register the store, add 20 real products with barcodes, receive stock, pair a kiosk, scan and pay at the kiosk, confirm cash at the cashier, verify the exit receipt, print the end-of-day report.
2. Run a backup and restore on a spare machine.
3. Confirm HTTPS works on the kiosk tablet and on a customer phone.
4. Decide your payment policy (cash only, or a real gateway) and tell staff.
5. Check local legal requirements for receipts and tax records in your country; this system's receipts are not tax invoices unless you add your tax details.
