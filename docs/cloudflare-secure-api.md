# Shipping Pulse — secure Cloudflare Pages API

Implemented: `GET /api/health`, `GET /api/session`, `GET /api/orders` (read only).
**Not yet activated on the live deployment.** No status updates or cash settlements are written by this API.

## Security model
- Verify Cloudflare Access signed JWT via Access public JWKS; validate issuer, audience, expiration, and email.
- Authorize each verified email against a server-side `USER_ROLES_JSON` mapping.
- Use Google service account OAuth JWT to read the test spreadsheet; secrets stay in Cloudflare, never GitHub/browser.
- Drivers can only view their orders **after** their verified email is mapped in DRIVERS `Email` column. Current test sheet has no Email column, so driver access intentionally returns 403 until mapping is implemented.
- Never deploy with a public Access bypass policy. No CORS enabled.
- No write methods; cash approvals must wait for transactional, auditable design.

## Cloudflare Pages setup
1. Configure Cloudflare Zero Trust Access application for the **entire** `shipping-erp.pages.dev` hostname (not just /api). Set policy to permitted identities only. Public demo should not be treated as a production system.
2. In Pages project Settings → Variables and Secrets set:
   - `ACCESS_TEAM_DOMAIN`: e.g. `yourteam.cloudflareaccess.com`
   - `ACCESS_AUD`: Access application AUD tag
   - `USER_ROLES_JSON` **secret**: JSON mapping emails to `admin`, `accountant`, `driver`.
   - `GOOGLE_SERVICE_ACCOUNT_JSON` **secret**: complete service account JSON from Google Cloud; NEVER put in GitHub.
   - `SPREADSHEET_ID` **secret**: ID of the test spreadsheet.
3. Enable Google Sheets API for the service account project and share the test spreadsheet **with the service account email as Viewer**.
4. Redeploy Pages. Check /api/health and /api/session as a permitted signed-in user.
5. Do not add production data or enable driver accounts until email mapping and auditing are ready.

The frontend is still a **local demo**; it is deliberately not yet connected to the API. This is a security foundation, not a claim of full integration.
