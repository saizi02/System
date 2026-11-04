# Final-year demonstration script (SSTWAS 2.0)

1. **Introduce** SSTWAS as an installable self-service till with a Customer app and three stand-alone dashboards — Admin console, Cashier station and Kitchen display — sharing one PostgreSQL database. Explain that **only payment authorisation is simulated**.
2. **Show the landing page**: Grocery, Food, Fashion profiles. Demonstrate a real PostgreSQL-backed list of shops.
3. **Super Admin** signs in at `/admin`, adds a product and stock. Create a **General Admin** for one store (type a password, show the strength checklist) and show that they see only their own store and cannot register stores or create admins. Show that a Cashier signing in at `/admin` is refused.
4. **Kiosk, no phone:** Choose the grocery store, start a guest session, add items, run a simulated EcoCash approval, obtain paid receipt and print it.
5. **Real stock update:** Show inventory after checkout and the order in Admin reports.
6. **Cash:** Create a pending cash order at the kiosk. Show the Cashier queue; Cashier confirms and only then is stock deducted.
7. **Scan & Go:** Scan a grocery product barcode from a smartphone camera; create a cart and pay on the phone; for cash, show the order number or QR to the cashier, who confirms it.
8. **Exit control:** Verify the paid grocery QR once via Cashier; repeat to show the duplicate is blocked and flagged.
9. **Food (two screens side by side):** Open `/kitchen` on one device and `/cashier` on another. Order a meal with an option, choose takeaway and add instructions. It appears on the Kitchen display within seconds; Kitchen taps *Start preparing* → *Mark ready*; the Cashier station announces it is ready and the cashier taps *Mark collected*. Print the kitchen ticket.
10. **Fashion:** Choose a clothing size or colour and check out; Cashier follows collection status.
11. **PWA:** Install SSTWAS to the home screen where supported; demonstrate that network loss blocks final checkout but preserves a draft cart.
12. **Accountability:** Open the Super Admin *Activity log* to show every sign-in, cash confirmation and kitchen step with who/when.
13. **Security:** Explain per-station sign-in, role permission matrix, hashed passwords, sign-in lockout, PostgreSQL session roles, server-owned stock, one-time idempotency keys and order receipts. Avoid claiming support for features not yet tested.
