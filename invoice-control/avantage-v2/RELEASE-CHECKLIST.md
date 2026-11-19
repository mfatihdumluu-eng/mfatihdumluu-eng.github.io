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
2. Set `AVANTAGE_STAGING_ORIGIN` as a plaintext EAS `preview` environment variable. The `store-beta` profile rejects a missing origin and the existing production origin.
3. Verify role-based access and duplicate/total checks. Confirm cross-branch data isolation.
4. Verify original document private storage, recovery, audit, encryption and retention before live financial use.
5. Perform multiple device upload/review tests and accessibility checks.

## Distribution
- Build a signed beta with `eas build --profile store-beta --platform all` from `mobile` after linking the EAS project and configuring signing.
- iOS: upload to App Store Connect and use a TestFlight external group for management testers who are not App Store Connect users. Submit the first external build for beta review and verify the invitation before sharing it.
- Android: upload the first AAB to the Play Console internal testing track, add the testers' Google accounts, and verify the opt-in link. Subsequent uploads can use `eas submit --profile store-beta --platform android` after configuring service-account access.
- Web: deploy /app alongside existing Fastify API; Windows/macOS browsers use same session-backed server.

## Publication blockers
- Render workspace confirmation and separate staging infrastructure
- Apple and Google developer accounts and store metadata/icons/privacy policy
- no mobile testing yet; do not claim store approval
- Apple App Review may reject a minimal WebView wrapper for insufficient native functionality: plan native photo-picker and review experience before public release.
- session/CSRF/security review, real vendor PDF acceptance testing, GDPR/DPA.
