# SSTWAS 2.0 — Clean Node.js + PostgreSQL Edition

A self-service checkout web app for grocery, fast-food and fashion outlets. It contains a **Customer** workspace (mobile/PWA + kiosk) and three **stand-alone staff dashboards** — **Admin console** (`/admin`), **Cashier station** (`/cashier`) and **Kitchen display** (`/kitchen`) — each with its own sign-in, all sharing one API and one PostgreSQL database. See [docs/ROLES-AND-STATIONS.md](docs/ROLES-AND-STATIONS.md). This is a **standalone application** using **React + TypeScript + Vite**, **Node.js + Express**, and **PostgreSQL**.

## What works in the source

- **Super Admin**: register stores, create every kind of account (Super Admin, General Admin, Cashier, Kitchen — with a password chosen at creation), reset/disable accounts, platform-wide activity log.
- **General Admin**: manages one store — catalogue, product variants, inventory, settings, reports, and that store's Cashier and Kitchen staff.
- Customer: mobile camera barcode scanning, hardware barcode scanner on the kiosk (see docs/BARCODE-SCANNER.md), searchable touch-kiosk catalogue, carts, receipts.
- Cashier station: cash approval, order handover, clothing pickup, grocery receipt exit checking.
- Kitchen display (Food stores): live New → Preparing → Ready board with timers and optional sound alert; the Cashier is notified when an order is ready.
- Checkout: server-side prices, inventory transactions, one-time order keys, and stock reservation/release for online payments.
- Payments: **Paynow Zimbabwe** supports EcoCash, OneMoney and card payments; cash is confirmed by the Cashier. Configure merchant credentials and test mode as described in [docs/PAYNOW.md](docs/PAYNOW.md). With no provider configured, the system is cash-only; demo approvals are not enabled by default.
- Receipts: digital receipt plus browser printing with thermal 80 mm print CSS.
- Currency: USD and ZiG using per-store rate snapshots.

**No weighing-device workflow**. Grocery products are sold as whole units by barcode or catalogue selection.

## Getting started on Windows

**Read [docs/WINDOWS-SETUP.md](docs/WINDOWS-SETUP.md)**. You need Node.js 20+, a running PostgreSQL server, and VS Code or PowerShell. No cloud account or project credentials are required.

The short version (commands run in project root, next to `package.json`):

```powershell
npm install
npm --prefix server install
Copy-Item .\server\.env.example .\server\.env
# Create a PostgreSQL database called sstwas_dev and update DATABASE_URL in server/.env
npm run db:migrate            # applies every sql/NNN_*.sql file once (001 schema, 002 roles & kitchen)
# Set temporary BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD in server/.env
npm run bootstrap:admin      # creates the first Super Admin
# Remove bootstrap credentials from server/.env once created
npm run db:seed
npm test
npm run build
```

Run **two separate terminals** with PostgreSQL running:

```powershell
npm run api:dev
```

```powershell
npm run dev
```

Vite prints the localhost address (typically `http://localhost:5173`, or 5174 if occupied). API health is at `http://localhost:3001/api/health` and should report `database: postgresql`.

## Architecture

```text
Customer PWA / touch-kiosk  ·  Cashier station  ·  Kitchen display  ·  Admin console
                  React + TypeScript
                         │
             /api via Vite development proxy
                         │
                Node.js + Express
           staff sessions · validation · checkout
                         │
                     PostgreSQL
    stores · staff · products · inventory · orders
```

`src/` contains the web app, `server/src/` the Express API, `server/sql/` the schema and `server/scripts/` migration, admin bootstrapping and sample shop data. Database configuration belongs in **server/.env**, not a frontend environment file. Never upload real credentials to GitHub.

## Testing and limitations

Backend validation unit tests can run with `npm test` after installation. The application still needs **local npm dependency installation, an actual PostgreSQL database, a successful production build and hands-on end-to-end tests**. A source archive is not proof of complete production readiness.

Offline browsing and draft cart persistence are supported where cached; offline checkout is **intentionally disabled** to prevent incorrect stock or duplicate transactions. Live data updates use 3-second polling, not push sockets. Receipt printing opens the normal browser print dialog; hardware-specific silent printer control is not included. Live payments require an approved Paynow merchant integration and credentials; the app defaults to Paynow test mode only when configured.

See [docs/ACCEPTANCE-CHECKLIST.md](docs/ACCEPTANCE-CHECKLIST.md) for functional checks before demonstration.

## Going live
See `docs/DEPLOYMENT.md` (Docker install, HTTPS, backups, hardware, security, payments) and `docs/BARCODE-SCANNER.md`. Settings are in `deploy/.env.example` (Docker) or `server/.env.example`.
