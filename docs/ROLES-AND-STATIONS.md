# Roles, permissions and stand-alone stations

SSTWAS 2.0 has **four staff roles** and **three stand-alone dashboards**. Every dashboard has its own address and its own sign-in page, but they all talk to the **same Express API and the same PostgreSQL database**, so they stay in sync (data refreshes every 3 seconds; each screen shows a green **Live** badge).

| Dashboard | Address | Accepts | Purpose |
|---|---|---|---|
| Admin console | `/admin` | Super Admin, General Admin | Stores, products, stock, staff accounts, reports, activity log |
| Cashier station | `/cashier` | Cashier (and Admins as supervisors) | Confirm cash, order handover, grocery exit checks |
| Kitchen display | `/kitchen` | Kitchen (and Admins as supervisors) | Food orders: New → Preparing → Ready |

Sign-in is enforced **by the server**: a Cashier typing their password into the Kitchen sign-in page is refused ("This account is not authorised for the Kitchen display"). Open each station on its own tablet or screen; the Admin console shows a QR code for each address (*Staff accounts → Stand-alone stations*).

## Roles

| Role | Scope | Can create | Notes |
|---|---|---|---|
| **Super Admin** | Whole platform, all stores | Super Admins, General Admins, Cashiers, Kitchen staff | Registers and suspends stores; manages accounts, kiosks, settings and reports; sees the platform-wide activity log. Day-to-day store work (products, inventory, transactions, flagged scans, shop QR codes) belongs to the General Admin and is not in the Super Admin menu. At least one active Super Admin must always remain. First one is created with `npm run bootstrap:admin`. |
| **General Admin** | One assigned store | Cashiers and Kitchen staff for that store | Manages catalogue, stock, settings, reports and the store's activity log. Cannot register stores or create other admins. |
| **Cashier** | One store location | – | Cash confirmation, handover of food orders, fashion pickup steps, grocery exit verification. |
| **Kitchen** | One Food store location | – | Sees only paid food orders. Can mark New → Preparing → Ready. Cannot confirm cash or hand over orders. |

### Passwords
- When an account is created the creator **chooses the password** (or clicks *Generate strong password*). Policy: 12–128 characters with uppercase, lowercase and a number.
- Option *Require the user to choose a new password at first sign-in* (on by default).
- Admins can **reset** a password; the user is signed out everywhere. Users can change their own password (*My account* / account button on each station) – other devices are signed out.
- Passwords are stored only as bcrypt hashes. After 8 failed sign-ins in 15 minutes the account/IP pair is locked out for the rest of the window.
- Disabling an account ends its sessions immediately.

## How the Cashier and Kitchen communicate (Food stores)

1. Customer pays (phone or kiosk). Cash orders wait in the **Cashier → Cash payment queue**.
2. Once paid, the order appears on the **Kitchen display** (new-order chime if sound is on).
3. Kitchen taps **Start preparing**, then **Mark ready**.
4. The **Cashier station** shows "Order #… is ready for handover"; the cashier gives the order to the customer and taps **Mark collected**.

Fashion stores have no kitchen: the Cashier performs every step. Grocery stores use exit-QR verification instead.

Every status change is written to the **activity log** with who did it and from which station.

## Permission matrix

| Action | Super Admin | General Admin | Cashier | Kitchen |
|---|:-:|:-:|:-:|:-:|
| Register / suspend stores | ✔ | – | – | – |
| Create Super Admin or General Admin | ✔ | – | – | – |
| Create Cashier / Kitchen accounts | ✔ (any store) | ✔ (own store) | – | – |
| Disable / reset password of other staff | ✔ (any) | ✔ (Cashier/Kitchen of own store) | – | – |
| Products, inventory, transactions, flagged scans, shop QR codes | – (not in the Super Admin menu) | ✔ (own store) | – | – |
| Store settings, reports, kiosk devices, shopper sessions | ✔ (any store) | ✔ (own store) | – | – |
| Platform activity log | ✔ | store only | – | – |
| Confirm / cancel cash, exit check | ✔ | ✔ | ✔ | – |
| Food: New → Preparing → Ready | ✔ | ✔ | – | ✔ |
| Food: Ready → Collected | ✔ | ✔ | ✔ | – |
| Fashion: all pickup steps | ✔ | ✔ | ✔ | – |

## Demo accounts
Set `DEMO_STAFF_PASSWORD` in `server/.env`, run `npm run db:seed`. For each demo store it creates `admin.<store>@sstwas.demo`, `cashier.<store>@sstwas.demo` and (Food store) `kitchen.food@sstwas.demo` with that password (store = `grocery`, `food`, `fashion`). Remove the variable afterwards; the seed is disabled in production.

## Store model
An installation runs in `STORE_MODE=single` (locked to one store) or `shared` (several isolated stores). In both, a store's General Admin, cashiers, kitchen staff and kiosks only see and change that store; cashiers, kitchen staff and kiosks are tied to one branch. See `DEPLOYMENT.md`.
