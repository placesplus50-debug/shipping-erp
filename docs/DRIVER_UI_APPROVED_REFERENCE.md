# Driver UI — approved pixel-level visual reference
Approved by owner: 2026-10-20.

## Source of truth
The generated vertical Shipping Pulse 2.0 mockup in the user conversation is the mandatory visual reference for the DRIVER interface. The screenshot is not currently committed as an image asset in this repository. Before claiming pixel-perfect fidelity, obtain the original image in the frontend implementation workspace and compare real device screenshots against it.

## Mandatory layout, top to bottom
1. Deep purple gradient status/header region with Shipping Pulse 2.0, menu, role label, greeting, online status and last update.
2. Four compact KPI tiles in a single row when screen width allows: total, delivered, in progress, returned. Use soft tinted backgrounds and matching icons. Adapt responsively for narrow devices without clipping.
3. Purple summary tiles: collection amount and map-based daily route overview. Never fabricate real route metrics; show loading/empty state if not computed.
4. White/light-lavender rounded content surface, with quick status chips and counts.
5. Single prominent shipment search field and filter control.
6. Results heading and count, then compact white shipment cards. Each card includes order ID, customer, area, status pill, payment method, amount, chevron and more-menu. Colors: red returned, amber in-progress, green delivered.
7. Two clear actions below the list: map and quick status update.
8. Deep purple fixed bottom navigation with overview, shipments (lime selected), route and collections.
9. Preserve Arabic RTL text flow, clear currency figures, touch targets, and spacing from mockup.

## Fidelity requirements
- No large grey native GPS strip obscuring the status bar; replace with compact, consent-based control matching the design.
- No giant yellow demo banner in the final driver UI.
- Match typography hierarchy, gradients, corner radii, shadow softness, icon size and card spacing.
- The mockup is illustrative, not a source of truth for numbers, customer names, payments, or GPS distance. Live data overrides example values.
- Do not imply offline, payment, or live tracking capabilities are working before connected and tested.
- Test at 360, 390, 412 and 430 CSS pixel widths, with Android safe-area insets and large font scaling.
- Produce side-by-side reference/actual screenshots and track visible differences before acceptance.

## Non-negotiable data rules
- No edits to original Google Sheets without explicit approval.
- No changes to legacy financial events or live D1 schema as part of visual styling.
- Never start location sharing without a driver's explicit consent.
