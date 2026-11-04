# SSTWAS 2.0 Presentation Checklist

Prepare a local PostgreSQL instance and run the Node.js API and React frontend in separate terminals. Validate npm build and unit tests first.

1. Super Admin logs in at /admin and registers a grocery shop; dashboard shows it.
2. Super Admin adds a product and 10 inventory units; chooses currency and exchange rate.
3. Customer mobile or kiosk scans/selects 2 units; checks out with fictional EcoCash/card approval.
4. Show resulting order in PostgreSQL transaction list; stock now 8; print demo receipt with grocery QR.
5. Cashier scans QR once (accepted) and repeats (duplicate flag).
6. Create pending cash order, then confirm it in Cashier workspace; show the stock change only after confirmation.
7. Show food menu and instructions; place a food order and follow it across /kitchen and /cashier on two screens; show fashion variant/pickup flow.
8. Create a General Admin with a password and show their restricted view; show the Activity log as Super Admin.
9. Prove declined simulated payment does not deduct stock; offline checkout is disabled, cached catalogue may still be browseable.
10. Explain that payment gateway communication is simulated, while stock, orders and accounts are actual database records.

Never claim silent printing, full offline sales reconciliation or tested cloud production deployment unless those have been implemented and verified.
