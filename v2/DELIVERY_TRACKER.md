# Shipping Pulse 2.0 — 13 feature delivery tracker
Last updated: 2026-10-20. Branch only. Not deployed.

Legend: FOUNDATION = isolated implementation code; NOT a working UI or production feature.

| # | Feature | State | Next integration |
|---|---|---|---|
| 1 | Any Google Sheet connector | FOUNDATION: pure mapping preview | Staging source registry, OAuth permissions, import preview UI |
| 2 | Advanced admin dashboard | FOUNDATION: pure metrics | Role-scoped API and dashboard screens |
| 3 | Dispatch and reassignment | PLANNED | Atomic assignment events, access control |
| 4 | Collections and cash custody | SCHEMA PROPOSAL | Ledger reconciliation, review workflow, staging finance tests |
| 5 | Advanced driver app | EXISTING APP + PLANNED | Integrated sections, accessibility, Android validation |
| 6 | Barcode and QR | PLANNED | QR payload design, camera permission, secure lookup |
| 7 | Proof of delivery | SCHEMA PROPOSAL | Secure object storage, consent and upload endpoints |
| 8 | Offline mode | FOUNDATION: safety policy | Encrypted read cache, drafts, conflict-safe sync |
| 9 | Notifications and alerts | SCHEMA PROPOSAL | Push subscription, opt-in, delivery worker |
| 10 | Improved live tracking | EXISTING OPT-IN GPS + PLANNED | Shift state, accuracy and retention tests |
| 11 | Excel and PDF reports | PLANNED | Read-only scoped exports and reconciliation |
| 12 | Read-only AI assistant | PLANNED | Scoped retrieval, citations, prompt injection controls |
| 13 | Data sources management UI | PLANNED | Add/preview/validate/disable source; no sheet writes |

## Required before rollout
- Staging D1 + test sheets, backup and restore rehearsal.
- Contract tests for cross-company duplicate IDs and financial idempotency.
- Finance migration separately approved; do not apply `v2/schema/001_proposed_v2.sql` on production.
- Run `cd v2 && npm test` with Node.js 20+.
- Do not merge or deploy feature branch without acceptance gates.
