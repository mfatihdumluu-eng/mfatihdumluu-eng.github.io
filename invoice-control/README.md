# Invoice Control

Portable proof-of-concept for a Netherlands-based multi-branch supplier invoice comparison platform. Frontend demo lives in `index.html` and runs on GitHub Pages without a build step. **No Lovable dependency, vendor lock-in or proprietary frontend runtime.**

## Current demo (NOT a production accounting system)
- Dashboard for nine branches with cross-branch supplier-product price comparison
- 9 branch-user positions + 1 business administrator + 1 system administrator (UI role simulation only)
- Price discrepancy matrix (same supplier, same month, EAN), reports and CSV exports
- Demonstration invoice rows and local CSV / limited UBL XML import
- Supplier register, draft objections, credit-note placeholders, audit illustration
- Dutch UI and responsive layout
- Does **not** send emails, store real invoices, provide authentication, process OCR/PDF or claim recovered savings.
- **Never upload real confidential invoices to a publicly served demo.** In-browser import is test-only and ephemeral.

## Next architecture (moveable hosting)
Recommended: independent TypeScript React/Vite frontend + Node.js/Fastify API or Python/FastAPI + PostgreSQL, containerized with Docker Compose. Use S3-compatible private object storage, a provider-independent SMTP server, background workers for parsing, and pluggable OCR adapters. All code and migration scripts in GitHub. Avoid proprietary platform SDKs and backend-in-frontend patterns; deploy to any VPS, managed container provider or internal server.

Schema: tenants, branches, memberships, users, suppliers, products, supplier_product_aliases, supplier_contract_prices, invoices, invoice_lines, invoice_documents, checks, anomalies, disputes, credit_notes, notifications, audit_events, email_outbox. Keys: tenant_id/branch_id are mandatory where relevant. Suppliers identified by VAT/KvK where appropriate; invoice uniqueness scoped by supplier, legal invoice number and tenant; price history immutable after review with versioned corrections.

## Essential production security
- Auth with unique identities and MFA, server-side authorization at every API query
- Nine employee accounts can access own branch only; admin all assigned branches; system admin manages identity/configuration. **Role switcher in demo is not security.**
- Branch-to-branch comparisons must be server-computed. Employee should see own values and permitted anonymized reference ranges, *not* others' original documents, invoice numbers or individual invoice financials
- Restrict signed file URLs, encrypt uploads, virus-scan files; backups and GDPR retention
- Never publish invoices in GitHub, GitHub Pages, or static build assets
- Admin review before sending supplier email; maintain email delivery/approval audit trail
- Numeric currency decimal arithmetic (not float) with normalized net EUR/unit, quantity tiers, packaging conversion, VAT, agreed discounts, contract prices, effective dates
- A cross-branch difference is an **investigation flag**, never automatically proof of overbilling
- Tests: permission matrix, duplicate detection, product identification ambiguity, price change policy, invoice totals, audit integrity, credit note reconciliation, and multi-tenant leakage.

## CSV demo input
Headers: `ean;quantity;unit_price` (EAN must match one of the demonstration products).

## Hosting
The static demo may be served under `/invoice-control/` on existing GitHub Pages, or directly on any static host. For production, host the secured API/database privately and publish only the frontend assets. Move freely by copying the repository and configuring environment variables.