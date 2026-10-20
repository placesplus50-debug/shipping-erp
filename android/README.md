# Shipping Pulse Android

A single Android app for admin, accountant, and driver roles. It uses the production Shipping Pulse website and existing session cookie for login and authorization. The server remains authoritative for permissions, orders, collections, and GPS submissions.

## Download APK
Open the repository **Actions** tab, select **Android Debug APK**, and run the workflow (or push to `android/**`). After the job succeeds, download `ShippingPulse-debug-apk` from the run's Artifacts. This is a **debug** build for testing, not a signed Play Store release.

## Driver location sharing
After logging in as a driver, the native Android location-sharing button appears. Starting it requests Android location permission and runs a foreground service with a persistent Stop action. GPS is sent every ~15 seconds to the existing authenticated `/api/driver-live-location` endpoint while the service is running. The driver can stop sharing at any time. Android or the network may interrupt updates, and GPS is never guaranteed.

## Important testing and limitations
- APK compilation, login, GPS delivery, and battery behavior must be verified on real Android phones.
- If the web session expires or the driver logs out, requests fail; do not treat old location as live.
- Location sharing is opt-in; no hidden tracking or permission bypass.
- This initial version has no persistent native sharing-state recovery after app process recreation.
- Android foreground location sharing is separate from the browser's map-sharing control; use one at a time during testing.
- No order or financial data is changed by Android code.
