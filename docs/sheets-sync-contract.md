# Preview Sheets synchronization contract (verified 2026-10-18)

Spreadsheet: `1A_SpdeOmyL0whm89c0egp2jknbarvM4RoPdXqbxfL1M`.
Live header inspection succeeded under authorized admin session. No writes have been made.

## TRACKING (A:J)
Event ID | Order ID | Driver ID | Old Status | New Status | Event Time | Collected Cash | Collection Method | Notes | Recorded By

Only driver shipping status transitions belong here. Event ID must be stable across retries. Monetary collection events must not be duplicated in TRACKING.

## COLLECTIONS (A:J)
Settlement ID | Order ID | Driver ID | Cash Collected | Cash Remitted | Outstanding | Remittance Date | Settlement Status | Reviewed By | Notes

Use **one settlement row per collection ID**; update that same row on review and handover, never append a second settlement for the same collection. Status sequence: pending -> approved/rejected -> remitted (approved cash only). Outstanding must represent driver-held cash, never electronic company-held payments. Monetary values in EGP (D1 stores cents).

## Activation blockers
1. Apply `migrations/preview_sheet_sync_outbox.sql` to Preview D1 only.
2. Verify Google OAuth grant includes Sheets WRITE scope. Existing orders reader only proves read scope.
3. Implement durable atomic outbox writes with each D1 business mutation. Never silently lose events between commit and queueing.
4. Implement idempotent Sheets upsert by stable Event ID / Settlement ID, with recovery from ambiguous write responses and retry.
5. Guard against simultaneous writers, reconcile backfill, and report sync health. Google Sheets cannot join the D1 transaction, so "instant" is best-effort immediate delivery with durable eventual retry.
6. Verify exact sheet updates on Preview using test records; only then consider production activation with explicit approval.

Do not enable write synchronization before all blockers pass. Do not modify ORDERS. Keep production and source Sheets unchanged until approved.
