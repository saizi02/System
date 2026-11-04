# SSTWAS 2.0 — Modules

```text
React PWA (Customer · Cashier station · Kitchen display · Admin console)
                 │
      Node.js / Express REST API
                 │
        PostgreSQL database
```

## Customer
Mobile Scan & Go, independent touch-kiosk mode, browse products, choose fashion variants or food instructions, choose realistic-looking SIMULATED payment and view/print digital receipt. Grocery products are sold by integer units, never by weight.

## Cashier station (`/cashier`)
Stand-alone dashboard with its own sign-in. Pending-cash review/confirmation, handover of food orders the kitchen marked ready, fashion pickup flow, one-time grocery exit QR verification and duplicate flagging.

## Kiosk app (`/kiosk`) — tablets and POS terminals
A dedicated, installable full-screen app. A device is paired once with an admin-issued code and then opens straight into the self-service till for its store location, with no exit links. It reports its status to the server, so Admin and Cashier see it online and know which kiosk an order or cash payment came from. See [KIOSK-DEVICES.md](KIOSK-DEVICES.md).

## Kitchen display (`/kitchen`)
Stand-alone dashboard for Food stores. Live board of paid orders (New → Preparing → Ready) with waiting timers, dine-in/takeaway labels, special instructions, kitchen-ticket printing and an optional new-order chime. Marking an order ready notifies the Cashier station.

## Admin console (`/admin`)
**Super Admin** registers stores, creates and manages every account type (passwords are chosen at creation), and sees the platform-wide activity log. **General Admin** runs one assigned store: products, stock, receipts, shopper sessions, flagged activity, reports, and that store's Cashier and Kitchen accounts. Full matrix: [ROLES-AND-STATIONS.md](ROLES-AND-STATIONS.md).

All authoritative writes use server-side validation. Approval/decline screens merely choose SIMULATED payment outcome; stock changes happen within database transactions, not in React.
