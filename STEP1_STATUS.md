# C-OIL Step 1 — Supabase Connected

## Completed on 11 November 2026
- Existing Supabase project `wbvflaqqiomqrdtndkqe` reused without changing recruitment tables or existing Edge Functions.
- Created `public.reviews`, private owner allowlist and private rate limits.
- Enabled review RLS: anonymous users read approved reviews; direct anonymous writes denied; owner privileges require explicit allowlisting.
- Deployed `submit-review` Edge Function with CAPTCHA validation, per-visitor rate limiting, allowed-origin checks, and fail-closed security settings.
- Updated `assets/config.js` in this website bundle with the real project URL and publishable key (both browser-safe, not secrets).

## NOT YET ACTIVE — required before a real customer submission
1. Configure a Cloudflare Turnstile widget for your actual website hostname, then place the public site key in `assets/config.js`.
2. Set the secure Edge Function environment variables (Supabase Dashboard > Edge Functions > Secrets): `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_SALT` (random 24+ character secret), `C_OIL_ALLOWED_ORIGINS` (comma-separated actual origin hosts). Without these, submissions are intentionally blocked.
3. Create your personal Supabase Authentication user (email and password) and obtain its UUID, then register that UUID in `private.review_admins`. Do not add any user until the account belongs to you.
4. Complete live tests from deployed origin: submit with Turnstile, verify pending, approve as owner, and confirm anonymous public visibility. Also test a non-admin cannot view or change pending records.

## Preview
Extract this ZIP. Open CMD inside the folder containing `index.html`, and run `python -m http.server 8000`. Open http://localhost:8000/index.html and http://localhost:8000/admin.html.
You can view the connected review feed; customer submission intentionally remains unavailable until Turnstile setup.

## Security
Keep `sb_secret_...`, `service_role`, Turnstile secret and RATE_LIMIT_SALT out of any GitHub repository or public web files. `sb_publishable_...` and project URL are safe for browser use. Do not publish any customer reviews until the full live acceptance tests pass.
