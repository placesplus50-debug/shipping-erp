# Shipping Pulse 2.0 — acceptance and safety checklist

## Phase 0 audit (pending verification)
- [x] Confirm current orders endpoint has a fixed Google Sheet source and no direct order write verbs.
- [x] Confirm role-scoped order retrieval and server-side status assignment checks.
- [x] Confirm D1-backed collection and live-location endpoints exist.
- [ ] Inventory full D1 schema and migrations; identify all foreign keys.
- [ ] Verify Cloudflare production/staging bindings are isolated.
- [ ] Confirm D1 backup and restore procedure.
- [ ] Confirm Google OAuth scopes and read-only permissions.
- [ ] Run API contract and end-to-end tests in staging.

## Integration contract (must pass before launch)
- [ ] Two companies use same external Order ID; no collision in status, cash or QR.
- [ ] Invalid/missing required columns produce preview errors without writes.
- [ ] Duplicate source rows are idempotent across repeated imports.
- [ ] Revoked OAuth connection does not expose tokens or corrupt imports.
- [ ] Read-only source sheet remains byte-for-byte unchanged.
- [ ] Sync failure is observable and recoverable without partial finance writes.

## Authorization
- [ ] Driver sees only assigned orders and own collection entries.
- [ ] Accountant can review permitted financial events but cannot change assignment without authorization.
- [ ] Admin can manage only authorized companies; super admin actions audited.
- [ ] IDOR attempts using another source/order ID return 403/404.
- [ ] API denies invalid origin and unauthenticated write requests.

## Finance
- [ ] Cash, transfer and Paymob, including partial/mixed payments.
- [ ] Duplicate submit with same idempotency key creates one event.
- [ ] Offline retries never double-post a collection.
- [ ] Approved events cannot be silently edited or deleted.
- [ ] Reversal records original event, reason, actor and time.
- [ ] Daily cash custody totals reconcile to reviewed events.

## Driver mobile
- [ ] QR code scans scoped internal order ID; manual lookup fallback.
- [ ] Offline mode labels cached data and pending changes clearly.
- [ ] GPS permission denied, approximate only, and disabled handled.
- [ ] Explicit stop removes active location sharing; privacy retention tested.
- [ ] Proof-of-delivery file access restricted by company/role.
- [ ] App remains usable at 360px viewport and with large system fonts.

## Release gate
- [ ] Tests green on staging.
- [ ] Backup and restore rehearsed.
- [ ] Owner signs off any source write-back, finance migration or production release separately.
