# Shipping Pulse Android (MVP)

A single role-based Android app loading the existing Shipping Pulse Cloudflare Pages system in a secure same-origin WebView. Login, roles, orders, and collections remain on the server; no D1 credentials are bundled.

## Build
Open the `android` directory in Android Studio (JDK 17, Android SDK 35) and build an APK with **Build > Build Bundle(s) / APK(s) > Build APK(s)**. This repository does not yet include a generated APK or verified Android build.

## Driver location
`TrackingService` is an Android foreground location service. It is only intended to be started by an explicit action in the Android app after driver login, while the app is visible and location permission has been granted. It posts GPS coordinates to the existing authenticated `/api/driver-live-location` endpoint using the WebView's session cookie. A persistent notification offers Stop. Android location may stop if permission is revoked, GPS is disabled, session expires, or the OS stops the service. No stealth/background permission or historical route storage.

**Integration still required:** add the native driver-only Start/Stop controls in MainActivity, validate role from `/api/session`, and verify cookie/auth behavior on physical devices before enabling live tracking. This code is not production ready.

No changes to orders, collections, or shipping status are made by the Android module.
