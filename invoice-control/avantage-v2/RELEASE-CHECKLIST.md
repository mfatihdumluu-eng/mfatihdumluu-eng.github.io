# AVANTAGE 2.0 release gates

## Current architecture
Same-origin secure Fastify server serves /app responsive portal. React Native WebView apps point to /app and share server-stored invoice database with browsers. No credentials are bundled. Existing web demo stays unchanged.

## Local smoke tests
- node --test invoice-control/avantage-v2/checks.test.mjs
- cd invoice-control/avantage-v2/mobile && npm install && npx expo start
- open web panel at /app after server login
- on iOS/Android confirm cookies, photo/file chooser, back navigation, camera, and session expiry.

## Staging first
1. Copy current Render service/environment to **separate** staging app/db; do not use live invoice data.
2. Configure staging URL in mobile App.js (prefer environment configuration before release).
3. Verify role-based access and duplicate/total checks. Confirm cross-branch data isolation.
4. Verify original document private storage, recovery, audit, encryption and retention before live financial use.
5. Perform multiple device upload/review tests and accessibility checks.

## Distribution
- iOS: Apple Developer account -> EAS iOS build -> App Store Connect -> TestFlight internal testing.
- Android: Google Play developer account -> EAS Android AAB build -> Google Play Console internal testing.
- Web: deploy /app alongside existing Fastify API; Windows/macOS browsers use same session-backed server.

## Publication blockers
- Render workspace confirmation and separate staging infrastructure
- Apple and Google developer accounts and store metadata/icons/privacy policy
- no mobile testing yet; do not claim store approval
- Apple App Review may reject a minimal WebView wrapper for insufficient native functionality: plan native photo-picker and review experience before public release.
- session/CSRF/security review, real vendor PDF acceptance testing, GDPR/DPA.
