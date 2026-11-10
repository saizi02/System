# Smart inventory

Apply `server/sql/009_stock_movements_expiry.sql` with `npm run db:migrate`, then restart the API.

## What it does
- **Stock movement log.** A database trigger records every change to `inventory.quantity` (sale, refund, void, goods in, manual correction) with the reason, order or purchase reference and the staff member. Nothing in the code can forget to log a change.
- **Reorder suggestions.** Uses paid sales from the last 14 days: average daily sales, days of stock left, and a suggested order that covers the chosen number of days (default 14).
- **Statuses.** Out of stock, low stock, expired, reorder soon (7 days or less left), expiring (within 14 days), slow mover (no sales in 30 days).
- **Expiry dates.** Optional per product and variant. Expired stock cannot be sold at checkout.
- **Goods in.** Scan the delivered product, enter the quantity, press Receive. It adds to current stock and is logged. Receiving a purchase order is logged the same way.

## Where
Admin portal, Inventory page: summary cards, Reorder suggestions, Receive stock, Stock movement log.

## Method (for the dissertation)
Forecasting is a simple 14-day moving average, not machine learning: daily rate = units sold in the last 14 days / 14; days left = stock / daily rate; suggested order = ceil(daily rate x cover days) - stock. Refunded and voided sales are excluded because only orders with status paid are counted.
