# Uitly — Nederlandse evenementenportal
Zelfgeschreven site zonder Lovable. Mobiel/web responsive.
## Live architectuur
- GitHub Pages: statische demo op /etkinlik.
- Vercel: frontend plus serverless API onder /api/events, /api/submissions en /api/admin.
- Neon PostgreSQL (EU): afzonderlijke evenementen, tickets en advertentie tabellen.
- DATABASE_URL en ADMIN_API_KEY zijn **uitsluitend server-side** Vercel-environment variables.
## Werking
Alle start-evenementen zijn duidelijk fictieve demo's. Nieuwe echte inzendingen worden in Neon opgeslagen als pending en pas na redactionele goedkeuring gepubliceerd. Een betaalde prijs is zichtbaar, maar **betalingen zijn nog niet geactiveerd**: demo-kassa verwerkt geen echte transacties. Stripe/Mollie checkout en webhookvalidatie zijn noodzakelijk voor echte tickets.
## Beveiliging
Admin API vereist x-admin-key, gebruikt 401 bij onjuiste sleutel. Verplaats later naar account-gebaseerde RBAC, audit logging en rate limiting op CDN/WAF-niveau.
