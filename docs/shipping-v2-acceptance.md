# Shipping Pulse 2.0 — Acceptance checks

## Release gate
Do not use live cash balances as reconciled until these checks pass against the deployed environment. The source ORDERS Google Sheet must remain read-only.

## Driver and shipment
- Login as a driver. Confirm only their assigned orders appear in /driver.html and /driver-route.html.
- Open the purple chevron. Verify customer, amount, COD, status and notes match the source order.
- Change Assigned → Out for delivery → Delivered and confirm event history persists after reload.
- Try an invalid transition and a duplicate requestId; expect HTTP 409 and no duplicate event.
- Verify another driver's order history returns HTTP 404.
- Verify route shows only active orders and only opens validated Google Maps URLs.
- Verify back navigation, small-screen layout and scroll.

## Collections and accountant
- Delivered order with positive COD: record cash collection, verify pending review and amount.
- Approve as accountant; verify approved driver-held cash increases, pending decreases.
- Hand over to cashbox; verify approved driver-held cash decreases and handed-over increases.
- Reject another collection; verify it is excluded from held cash.
- Record company_transfer / paymob; verify company-held amounts do not become driver cash.
- Repeat a handover; expect HTTP 409 and no double count.
- Try to collect more than remaining COD; expect HTTP 409.
- Attempt PATCH/PUT /api/collections as driver; expect HTTP 403.
- Verify driver can only see their own records and accountant sees authorized scope.
- Verify truncated collection history blocks summary rather than reporting misleading balances.

## Deployment dependencies
- Confirm Cloudflare Pages deployment of main succeeded and DB binding is present.
- Confirm required D1 tables/migrations exist, especially collection_events, collection_reviews, cash_handover and driver_status_events.
- Confirm Google OAuth connection and configured ORDERS sheet are available.
- Confirm optional Google Sheets outbox dispatcher status separately; a D1 write is not proof of a Sheets update.
- Validate on mobile and desktop with real test accounts before production rollout.
