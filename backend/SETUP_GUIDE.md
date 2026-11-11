# C-OIL — remaining review-system configuration

This release preserves the approved C-OIL Version 9 design and images. **Step 1 has been partly completed on the existing Supabase project**: reviews SQL migration applied, submit-review Edge Function deployed, and the website public Supabase connection configured. See STEP1_STATUS.md for the current verified status. **Owner login, Turnstile keys, server-side secrets, and live end-to-end tests still require setup.**

## 1. Project already connected

The user authorized using the existing Supabase project `wbvflaqqiomqrdtndkqe` for this phase. C-OIL tables and policies are separate from recruitment tables. The website `assets/config.js` already contains the project URL and safe-to-publish publishable key. Never copy a secret or service-role key into the website.

## 2. Database migration already applied

Do **not** rerun the migration unless intentionally rebuilding or auditing the review schema. The source SQL is at:

`supabase/migrations/20261111120000_c_oil_reviews.sql`

The migration has already run and creates a public `reviews` table, a private admin allowlist, strict row-level-security policies, and an anti-spam rate-limit function. The public can read **approved reviews only**. No one can directly insert reviews using the browser key. Review content becomes immutable once stored, although an owner can remove it.

For a new project only, use the Supabase CLI from the `backend` directory:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

## 3. Create the owner's login

In **Supabase > Authentication > Users**, create or invite one owner with a strong password. Confirm the email. Copy the newly created Auth user's **UUID** (not the email address). Run in SQL Editor:

```sql
insert into private.review_admins (user_id)
values ('REPLACE_WITH_YOUR_SUPABASE_AUTH_USER_UUID');
```

Do not enable open admin sign-up. Use the Supabase Auth settings to disable public self-service account creation for this project. Enable MFA on the owner's account when available. Do not add customer accounts to `private.review_admins`.

Admin page (after deployment): `https://YOUR_SITE/admin.html`. It is not linked from public navigation; access security relies on Supabase Auth and server-side RLS, **not on the URL being hidden**.

## 4. Configure Cloudflare Turnstile

Create a Turnstile widget for your website domains, including your first GitHub Pages hostname and later `seaoil.com` / `www.seaoil.com` when purchased. Copy the **site key** and **secret key**. Local `localhost` testing must also be supported by the widget's hostname configuration, or use Cloudflare's published test keys for development. Do not ship test keys in production.

## 5. Supabase function already deployed; configure its secrets

Install the Supabase CLI. From the `backend` directory, run:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set TURNSTILE_SECRET_KEY="YOUR_TURNSTILE_SECRET" RATE_LIMIT_SALT="GENERATE_A_LONG_RANDOM_SECRET" C_OIL_ALLOWED_ORIGINS="https://YOUR_USERNAME.github.io,https://www.seaoil.com,https://seaoil.com,http://localhost:8000"
# The submit-review function is already deployed. Redeploy only after code changes:
supabase functions deploy submit-review --no-verify-jwt
```

Replace the actual GitHub Pages origin: if your site is `https://YOUR_USERNAME.github.io/YOUR_REPO/`, the origin is **only** `https://YOUR_USERNAME.github.io` (without the path). Include `http://localhost:8000` only during testing; remove it for production. Cloudflare Turnstile and the server's allowed origins must include every public hostname you use.

`RATE_LIMIT_SALT` must be a securely generated random secret of at least 24 characters. `TURNSTILE_SECRET_KEY`, `RATE_LIMIT_SALT`, and any Supabase service/secret keys belong **only** in Supabase server-side secrets, never in GitHub, `assets/config.js`, or public website files.

The function requires the managed environment's `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`). Supabase normally supplies the former variables for deployed functions; verify deployment logs if those variables are absent. The function **fails closed** if a required secret is missing.

## 6. Configure the website

The URL and public publishable key are already populated in **`assets/config.js`**. Before uploading, replace only the Turnstile site-key placeholder:

```js
window.COIL_CONFIG = {
  supabaseUrl: "https://wbvflaqqiomqrdtndkqe.supabase.co",
  supabasePublishableKey: "YOUR_EXISTING_PUBLIC_PUBLISHABLE_KEY",
  turnstileSiteKey: "YOUR_TURNSTILE_SITE_KEY"
};
```

`supabaseUrl`, publishable key, and Turnstile site key are intentionally public. Never add a Supabase `service_role` / secret key to `config.js`.

## 7. Launch on GitHub Pages

1. Create a new GitHub repository for C-OIL.
2. Upload **the contents of the separately supplied `C-OIL_V10_GitHub_Pages.zip`** directly at the repository root, so `index.html` is at the root. Do not upload the backend SQL/function folder to the website repository.
3. In repository **Settings > Pages**, choose **Deploy from a branch**, set `main` / root, then save.
4. Visit `https://YOUR_USERNAME.github.io/YOUR_REPO/` and confirm that all local images and page navigation work.
5. When you own a domain, follow GitHub Pages official custom-domain instructions to configure its DNS and HTTPS. Add it to `C_OIL_ALLOWED_ORIGINS` and your Turnstile hostnames before switching QR codes to that domain.

## 8. Run the real acceptance tests before publishing QR codes

- [ ] Website loads on Chrome and another mobile browser.
- [ ] Five marine photos slide one over another with working prev/next buttons.
- [ ] Shark artwork spins once (unless reduced motion is enabled).
- [ ] Public visitor submits a 4-star review and sees a **received, awaiting moderation** message.
- [ ] The review does **not** appear publicly while pending.
- [ ] A signed-in unauthorized account cannot read pending reviews, update/delete, or access the owner dashboard.
- [ ] The owner logs into `admin.html`, approves the review, and signs out.
- [ ] A new anonymous browser sees the approved review within 30 seconds, without website redeployment.
- [ ] The owner hides a review; it disappears from the public feed on refresh.
- [ ] The owner deletes a review; it is removed from the database.
- [ ] A failed CAPTCHA or missing Turnstile token **does not** create a review.
- [ ] Multiple submissions from the same network trigger rate limiting.
- [ ] Negative-but-genuine reviews can be approved; content is never fabricated or rewritten.
- [ ] Test at the final custom domain before printing QR codes.

## Important launch notes

- Reviews appear automatically **after owner approval**, normally on the next public page refresh or 30-second poll. Live review updates do not require a GitHub redeployment.
- The site does not have online ordering or payment collection, as instructed.
- Visitor reviews are not independently verified purchases. Avoid labeling them “verified buyers.”
- You must configure Auth, database, Turnstile, function secrets, site keys, and DNS in your own accounts. This package cannot create those credentials for you.
- This is frontend/backend application code, not certification of the skincare product or validation of historical/medical claims.
- Review security, rate limits, data handling, and access controls should be rechecked after deployment and reviewed periodically. Remove stale entries in `private.review_rate_limits` as routine maintenance.
