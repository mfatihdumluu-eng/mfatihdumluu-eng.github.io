# Google Document AI Invoice Parser — EU

## Activation boundary

This integration is prepared but has not enabled the Google API, created an
Invoice Parser, granted IAM access, configured Render credentials, or performed
a billable Google test. Obtain the owner's cost approval before enabling the
paid service. The deployment's current provider remains Nutrient unless changed.

Google's standard on-demand price checked on 2026-11-15 is USD 0.10 per document
of up to 10 pages (before tax/currency conversion). This integration rejects
documents over 10 pages before sending them. One request is sent per click;
retries after an ambiguous timeout may incur a second charge. Do not reserve
provisioned capacity, train a custom processor, upgrade a Render plan, or create
additional infrastructure as part of this setup without separate approval.

## Google Cloud (after approval)

1. Identify the owner's intended Google Cloud project and inspect its billing
   status. Do not create/link/upgrade a billing account without approval.
2. Enable `documentai.googleapis.com` in that project.
3. Create an **Invoice Parser** (`INVOICE_PROCESSOR`) named
   `invoice-control-eu` in the **eu** multi-region. Use an available stable
   pretrained version; do not select a preview or provisioned service tier.
4. Record the project ID and processor ID. Both the resource path and API
   hostname must use `eu`. An EU processor alone does not establish the location
   of the existing PostgreSQL database; inspect that separately without moving it.
5. Use a dedicated backend identity with `roles/documentai.apiUser` scoped to
   the intended processor where supported. The runtime does not require
   Owner, Editor, or Document AI Administrator. Creating/granting this access is
   a security-sensitive action and must be reviewed at the time it is applied.

## Authentication on Render

Use Application Default Credentials (ADC). Credentials never enter the browser,
GitHub Pages, request bodies, database integration settings or application logs.
The application uses Google's official `google-auth-library`, requests the
`cloud-platform` OAuth scope and obtains short-lived request authorization.
IAM controls which resources that authorization can access.

### Preferred: existing Pro-or-higher workspace, Workload Identity Federation

Render managed OIDC currently requires a Pro-or-higher workspace. Inspect the
existing workspace plan before choosing this option; do not upgrade it silently.

- Configure a Google workload identity pool/provider for Render's issuer
  `https://oidc.render.com/WORKSPACE_ID`, default audience, and
  `google.subject = assertion.sub`.
- Restrict the provider and IAM binding to the **exact** backend subject:
  `workspace:WORKSPACE_ID:environment:ENVIRONMENT_ID:service:SERVICE_ID`.
  For a service outside a Render environment, the environment component is
  `default`. Do not authorize every service in the workspace.
- Grant the federated principal processor access directly, or let it impersonate
  the dedicated service account using `roles/iam.workloadIdentityUser` on that
  account. Enable IAM, STS and (for impersonation) IAM Credentials APIs as needed.
- Set `GCP_WORKLOAD_IDENTITY_PROVIDER` on the existing Render service and, if
  impersonating, `GCP_SERVICE_ACCOUNT_EMAIL`.
- Render creates the credential configuration and sets
  `GOOGLE_APPLICATION_CREDENTIALS` at deploy time. **Do not override it manually
  when using managed OIDC.** No long-lived private key is needed.

### Otherwise: service-account file in Render Secret Files

If the existing plan does not support managed OIDC, a dedicated service-account
key can be stored only in Render Secret Files, subject to the owner's approval
for creating persistent credentials. Do not paste a private key into chat or
commit/download it into the public repository. Use the supported secure transfer
or owner handoff to configure it, then remove temporary copies.

- Secret filename: `google-document-ai-credentials.json`.
- Set `GOOGLE_APPLICATION_CREDENTIALS` to
  `/etc/secrets/google-document-ai-credentials.json`.
- Restrict IAM to the processor, and establish a key rotation/revocation process.

## Existing service settings

Confirm the Render workspace and the existing `invoice-control-api` service
before making changes. Merge only these keys, preserving `DATABASE_URL`, session
and encryption settings, mail settings and all other existing variables:

| Variable | Value |
| --- | --- |
| `INVOICE_OCR_PROVIDER` | `google-document-ai` |
| `GOOGLE_DOCUMENT_AI_LOCATION` | `eu` |
| `GOOGLE_CLOUD_PROJECT` | verified project ID |
| `GOOGLE_DOCUMENT_AI_PROCESSOR_ID` | verified EU processor ID |
| `GOOGLE_DOCUMENT_AI_ENABLED` | `false` until cost approval and authentication are ready |

Do not store credentials in `render.yaml`. Keep the existing PostgreSQL URL and
database region unchanged. Deploy the code, run the additive bootstrap migration,
then confirm `/health` and authenticated reader status. `configured: true` means
configuration exists; it does not mean credentials or processing have been tested.

## Acceptance test after activation approval

Set `GOOGLE_DOCUMENT_AI_ENABLED=true`, deploy, and process one **complete** sample
invoice through `/admin/invoice-reader`. A photograph marked “Pagina 1 van 2” is
incomplete: obtain the second page and combine both into a single PDF first.
Do not call the prior OCR endpoint or another provider as an automatic fallback.

Compare invoice number, supplier, all product rows and row order, quantities,
unit prices, line totals, VAT summary and overall totals against the document.
Missing line tax rates or discounts require correction; never invent them.
Confirm the branch, review the result, and save only an intended real record.
Verify its source and branch in the archive, duplicate protection, and the same
month comparison if another matching invoice exists. A synthetic test invoice
must stay in a separate test database, not the production shared pool.

Report actual Google results separately from mocked tests. If permission covers
only a one-document test, disable processing afterwards pending ongoing-use
approval. A Google billing budget alert is a notification, not a hard spend cap.

## References

- https://cloud.google.com/products/document-ai/pricing
- https://docs.cloud.google.com/document-ai/docs/processors-list
- https://docs.cloud.google.com/document-ai/docs/send-request
- https://docs.cloud.google.com/document-ai/docs/access-control/iam-roles
- https://render.com/docs/oidc
- https://render.com/docs/configure-environment-variables
