# Shipping Pulse Android

One Android app for all roles. The existing Cloudflare Pages website remains the source of truth for authentication, authorization, orders, and collections. The Android shell loads https://shipping-erp.pages.dev/ and navigates to the existing role-specific pages after login. Do not place secrets or D1 credentials in this app.

Open the `android` folder in Android Studio, install SDK 35, and run the app. This is a WebView-based MVP, **not** a background GPS tracking implementation. Native foreground-service location tracking requires a separately tested implementation, explicit driver opt-in, persistent notification, and Android runtime permissions. No APK has been built or tested yet.
