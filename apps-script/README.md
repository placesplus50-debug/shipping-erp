# Shipping Pulse — Google Sheets Integration

## Status
Stage 1: **read-only integration scaffold**. No live connection, no write API, no real authentication yet. The published dashboard continues to use local demo data.

## Source spreadsheet
Expected tabs: `ORDERS`, `DRIVERS`, `TRACKING`, `COLLECTIONS`, `SETTINGS`.

## Setup (without changing any sheet contents)
1. Open the **test spreadsheet** in Google Sheets and choose Extensions → Apps Script.
2. Add the code from `apps-script/Code.gs` to a new Apps Script project (do not replace an existing script).
3. In Apps Script Project Settings → Script Properties, create `SPREADSHEET_ID` with the test spreadsheet ID.
4. Run `testConnection` from the editor and authorize read access. Inspect the log for expected tab names and row counts.
5. Do **not** deploy the script as an anonymous web app. A safe authentication and server-side proxy must be implemented before the website reads real customer data.

## Next steps
- Confirm actual column headers and normalize records (order number, customer, driver, amount, prepaid, COD, delivery state).
- Implement authenticated server-side API and strict role-based permissions.
- Log every status or cash movement in append-only TRACKING / COLLECTIONS with server timestamps and actor IDs.
- Ensure collection approval is accountant-only; separate collected, held and remitted balances.
- Integrate the website only after security and test cases pass.

**Never commit Google credentials, API keys, or customer data to GitHub.**
