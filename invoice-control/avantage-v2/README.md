# AVANTAGE Invoice Control 2.0
Product: AVANTAGE (not EMIGRO).

## Baseline
Existing GitHub Pages front end is a demonstration; actual invoice OCR/review and archives use the private Fastify/PostgreSQL server. Do not upload real invoices to GitHub Pages.
The existing server supports PDF/image OCR, invoice validation, and a Nutrient integration. Existing documentation says original documents are not stored permanently.

## Architecture
- Web: responsive React/Vite web application for desktop/tablet.
- iOS + Android: React Native with Expo; shared authenticated business API.
- API: retain Fastify, add versioned /api/v2 routes behind verified authentication, role/tenant/branch scoping.
- Postgres: one authoritative dataset, immutable audit events, exact cents or decimal values for money.
- Private object storage in EU region for originals, signed URLs, malware checks and retention.
- OCR: adapter around existing extractor, manual review of uncertainty, no invented values.
- Checks: duplicate invoice scoped by tenant+supplier+number; totals/BTW; normalized unit and contract prices.
- Deploy: separate staging environments; production preserved until approved.

## Safety gates
Server-side permission checks on every endpoint; MFA, secure mobile token storage, backup/recovery, AVG/GDPR review. Never embed secrets in app, GitHub Pages or client bundles.
No deployment/database mutation in this initial foundation.

## Initial deliverables
Pure invoice check module and Node tests. Expo multiplatform starter demonstrating screens only. It is not connected to real invoices yet.

## Local commands
node --test invoice-control/avantage-v2/checks.test.mjs
cd invoice-control/avantage-v2/mobile
npm install
npx expo start

## Release/test workflow
Web staging deployment -> browser/desktop test; iOS via Apple TestFlight, Android via Google Play internal testing. All three connect to a dedicated staging API/database first, then production only after permissions and invoice tests pass.
