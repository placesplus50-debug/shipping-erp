# Shipping Pulse 2.0 — Implementation plan
Status: APPROVED SCOPE / DESIGN ONLY. No production data, Google Sheets, D1 tables, or financial transactions have been changed.
Date: 2026-10-20

## Verified baseline (repository review)
- Cloudflare Pages Functions + D1, web UI, Android WebView with opt-in foreground GPS.
- `functions/api/orders.js`: read-only Google Sheets source, fixed spreadsheet ID and `ORDERS!A1:N` range; role-scoped results.
- `functions/api/driver-status.js`: validates status, order assignment, request ID and role; stores state separately.
- `functions/api/collections.js`: collection events/reviews and cash handovers; financial changes must not be migrated casually.
- `functions/api/driver-live-location.js`: driver opt-in POST and admin GET; explicit location deletion on stop.
- Existing web UI has role-specific pages and driver navigation.
These findings are from source inspection, not a live end-to-end test.

## Non-negotiable safety rules
1. Source spreadsheets stay READ-ONLY until the owner explicitly authorizes write-back per source.
2. Existing D1 and finance records stay untouched. No migrations on production without backup, review and explicit approval.
3. Work in isolated feature branch and staging environment; never auto-merge to main or deploy to production.
4. Never use order ID alone as a global key across multiple sources. Use internal immutable order UUID plus source_id + external_order_id, with unique(source_id, external_order_id).
5. Server-side role and row-scope enforcement on every endpoint. No authorization based solely on UI.
6. Financial ledger is append-only: reversals and adjustments, no silent overwrite; idempotency keys for each write.
7. Offline queue must not automatically retry money operations without idempotency and conflict checks.
8. Location sharing opt-in only, clear stop control, retention limits and driver visibility.

## Delivery phases and gates
### Phase 0 — audit, backup and staging (blocking)
- Inventory APIs, D1 schema/migrations, Google OAuth scopes, deployment bindings, role matrix, source sheet format.
- Create backup/restore drill for D1; establish separate staging D1 and Google test sheet.
- Add smoke tests: auth, scoped orders, status transitions, collections, GPS start/stop.
- Gate: tested staging with no production write permissions.

### Phase 1 — unified data foundation
- Source registry: source ID, company, spreadsheet ID, worksheet/range, credential reference, enabled, read-only policy.
- Mapping profiles with preview, required-field validation, row errors and deduplication; do not store Google tokens in UI.
- Internal orders keyed by UUID; external IDs scoped to source, with immutable provenance.
- Sync import jobs with dry-run and audit trail; incremental pull, retries and safe rollbacks.
- Gate: two test sheets with overlapping order IDs imported without collisions; source sheets unchanged.

### Phase 2 — operations and dashboard
- Admin overview: company/driver/date/status KPIs, exception queue and delayed deliveries.
- Assignment and bulk reassignment with role checks, conflict prevention and event history.
- Driver mobile screens and QR scanning with manual fallback; QR resolves scoped internal order ID only.
- Gate: assignment and QR workflows tested for unauthorized access and duplicates.

### Phase 3 — collections and cash custody (high risk)
- Design immutable ledger: obligation, payment event, holder, review, handover, reconciliation, reversal.
- Support cash/company transfer/Paymob and partial/mixed payments.
- Dual review/approval controls and immutable audit evidence; daily reconciliation and discrepancy reports.
- Gate: accountant sign-off against fixed test cases; no changes to existing financial tables until approved migration.

### Phase 4 — field workflows
- Proof of delivery: signed/photo/OTP methods, explicit consent and retention/access policy.
- Offline read cache + encrypted local queue, conflict resolution and visible pending/synced/failed states.
- Opt-in GPS shift tracking, accuracy/last-seen and reliable stop semantics.
- Push notification permission/opt-in, no sensitive payloads in notification previews.
- Gate: airplane-mode tests, permission tests, duplicate submission tests and privacy review.

### Phase 5 — reporting and assistant
- Role-scoped Excel/PDF exports; totals reconciled to approved ledger.
- Read-only AI assistant with retrieval over authorized data; show sources, never execute financial actions.
- Gate: exports reconcile to ledger; AI cannot access another company/driver.

### Phase 6 — release
- Automated regression, accessibility and Android device tests.
- Staged rollout with feature flags, monitoring, incident response and rollback.
- Gate: written acceptance for each feature; production enablement is a separate decision.

## Suggested module boundaries
- `integrations/sheets`: registry, mapping, import preview, dry-run, ingestion workers.
- `domain/orders`: canonical IDs, status events, assignments.
- `domain/finance`: append-only collections ledger and settlement controls.
- `domain/tracking`: shift consent, location and retention.
- `domain/notifications`: opt-in delivery and queue.
- `reports` and `ai`: read-only, server-scoped data views.

## Next implementation slice (safe)
1. Create staging-only schema proposal and migration files (NOT applied).
2. Build source registry and mapping UI against fixtures, without any write connection.
3. Add contract tests for duplicate external IDs across companies and row-level authorization.
4. Review with owner before provisioning staging credentials or touching D1.

## Scope approval
All 12 requested features approved for PLANNING: multi-Sheet connector, admin dashboard, dispatch, cash custody, driver app, barcode/QR, proof of delivery, offline, notifications, GPS, Excel/PDF, AI. This is not permission to alter production financial data or source sheets.
