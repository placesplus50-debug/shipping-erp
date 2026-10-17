# Shipping Pulse — verified test-sheet mapping

Verified from connected Google Sheet on 2026-10-17 (read only).

## ORDERS
A Order ID; B Order Date; C Customer; D Phone; E City / Area; F Driver ID; G Order Total; H Prepaid Amount; I COD Due; J Payment Type; K Shipping Status; L Payment Status; M Notes.

## DRIVERS
A Driver ID; B Driver Name; C Phone; D Active; E Notes.

## TRACKING
A Event ID; B Order ID; C Driver ID; D Old Status; E New Status; F Event Time; G Collected Cash; H Collection Method; I Notes; J Recorded By.

## COLLECTIONS
A Settlement ID; B Order ID; C Driver ID; D Cash Collected; E Cash Remitted; F Outstanding; G Remittance Date; H Settlement Status; I Reviewed By; J Notes.

## SETTINGS
A Shipping Status; B Payment Type; C Payment Status; D Settlement Status; E Collection Method.

## Rules
- Shipping Status, Payment Status, and Settlement Status are separate concepts.
- Prepaid and Company transfer orders do not create driver cash custody solely because COD Due is nonzero.
- Driver cash custody = actual cash collected minus actual cash remitted, never estimated from Order Total.
- For the sample ORD-1003: cash collected 1500, remitted 500, outstanding 1000.
- Returns without actual cash collected have zero driver custody.
- Driver may update assigned orders only; accountant alone approves remittances. Both require authenticated server-side authorization, not a client-side dropdown.
- Store actor and timestamp for every change. Never treat a localStorage demo as a production ledger.
- No customer names, phone numbers, access tokens or credentials in this repository.

## Next implementation gate
Before connecting the public Cloudflare Pages site to real order data, deploy a secure authenticated API (e.g. Cloudflare Worker) with role checks, secret storage and server-side Google Sheets access. No anonymous Apps Script web app or publicly exposed spreadsheet.
