## Linket Connect

Modern NFC-ready profile pages with a pastel beach palette. Built with Next.js App Router, TypeScript, Tailwind (shadcn/ui), Framer Motion, and Supabase Auth + Storage.

### Quick start

1) Install deps

```bash
npm install
```

2) Copy env and add your Supabase project keys

```bash
cp .env.example .env.local
# set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

3) In Supabase, create the `links` table + RLS policies (paste in SQL editor):

```sql
create extension if not exists pgcrypto;

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

alter table public.links enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'links' and policyname = 'links_owner_all'
  ) then
    create policy links_owner_all on public.links for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'links' and policyname = 'links_public_select'
  ) then
    create policy links_public_select on public.links for select using (true);
  end if;
end $$;
```

4) Run dev server

```bash
npm run dev
```

Open http://localhost:3000

### Environment

Required vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `NEXT_PUBLIC_SITE_URL` for sitemap/robots and OpenGraph base (defaults to http://localhost:3000)
- `SUPABASE_SERVICE_ROLE_KEY` for server-side billing/lead update workflows
- `STRIPE_SECRET_KEY` for Stripe API/webhook processing
- `STRIPE_WEBHOOK_SECRET` for Stripe signature verification
- `STRIPE_PERSONAL_PRO_PRICE_IDS` comma-separated Stripe Price IDs that should count toward personal Pro loyalty accrual
- `STRIPE_WEB_PLUS_LINKET_BUNDLE_PRICE_ID` Stripe Price ID for one-time Web + Linket Bundle checkout
- `STRIPE_LINKET_BUNDLE_SHIPPING_RATE_IDS` comma-separated Stripe Shipping Rate IDs used for bundle checkout
- `STRIPE_LINKET_BUNDLE_ALLOWED_SHIPPING_COUNTRIES` optional comma-separated ISO country codes (defaults to `US`)

### Stripe loyalty accrual

- Webhook endpoint: `/api/stripe/webhook`
- Loyalty accrues from Stripe paid billing periods only.
- Bundle complimentary Pro entitlement starts when the purchased Linket is claimed, not at checkout time.
- Eligibility is granted after 365 total paid days (continuous or discontinuous).
- To map Stripe events to a user, include `user_id` (or `supabase_user_id`) in Stripe metadata on the invoice/subscription/customer.
- For strict personal-only accrual, configure `STRIPE_PERSONAL_PRO_PRICE_IDS` to your personal Pro price IDs.

### Granting admin access

Use the new `admin_users` table to control who can open the manufacturing console and other privileged tools.

1. In Supabase Studio (or the SQL editor) insert a row:

   ```sql
   insert into public.admin_users (user_id, created_by)
   values ('<auth-user-id>', '<your-admin-user-id>');
   ```

   You can find the `user_id` in Auth → Users. `created_by` is optional metadata.

2. The record automatically grants the user permission to query the minting API/UI because of RLS policies that only expose the row to the owner.

3. To revoke access later:

   ```sql
   delete from public.admin_users where user_id = '<auth-user-id>';
   ```

Changes take effect immediately—have the operator sign out and back in if the sidebar doesn’t update.

### Features

- App Router with pages: `/`, `/login`, `/dashboard`, `/u/[username]`, `/pricing`, `/about`, `/contact`, `/customize`
- Polished Navbar/Footer rendered globally
- Landing sections with shadcn Cards/Buttons and subtle Framer Motion animations
- Dashboard profile editing (display name, tagline, username) with username uniqueness handling
- Avatar upload to Supabase Storage (`avatars` bucket) and preview
- RLS-safe public profile page by `username`
- SEO basics: `robots.ts`, `sitemap.ts`, Open Graph metadata

### Leads Capture

- Public profile pages include a lead form that saves submissions to a `public.leads` table in Supabase (see SQL in `src/components/public/PublicLeadForm.tsx`).
- Dashboard → Leads lists your recent submissions with search, CSV export, delete, and live updates.
- Optional email notifications on new leads via Resend.

Setup

1) In Supabase SQL editor, create the `public.leads` table using the snippet in `src/components/public/PublicLeadForm.tsx` (includes RLS policies so anyone can insert, owners can read/delete).
2) Add environment variables for server-side notifications (optional):
   - `SUPABASE_SERVICE_ROLE_KEY` — used server-side to look up the owner email by `user_id`.
   - `RESEND_API_KEY` — API key for Resend.
   - `LEADS_FROM` — optional, email “from” address (defaults to `onboarding@resend.dev`).
   - `LEADS_TO` — optional, override destination for all lead emails (defaults to the owner’s auth email).
3) Deploy. New lead submissions will save to Supabase and, if configured, email the owner.

Troubleshooting submit failures

- If the form toasts “Could not submit”, open DevTools → Console and look for `lead-submit-failed` — it includes the Supabase error message.
- Common causes and fixes:
  - relation "leads" does not exist → Run the SQL block in `src/components/public/PublicLeadForm.tsx` to create the table.
  - new row violates row-level security policy → Ensure the `leads_anon_insert` policy exists and `anon` has `INSERT` privilege (both are in the SQL block).
  - Invalid API URL/key → Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`.

Notes

- The public form includes a honeypot field to deter basic bots.
- Source URL is captured to help attribute submissions.

### Supabase setup

- Create a `profiles` table with columns similar to:
  - `user_id: uuid` (PK, references auth.users.id)
  - `username: text` (unique)
  - `display_name: text`
  - `tagline: text`
  - `avatar_url: text`
  - `theme: text`
- Enable RLS with policies that allow:
  - Users to `select/update` their own row
  - `select` by `username` for anon (public profiles)
- Create a public Storage bucket named `avatars`.

- Auth → URL Configuration: add `http://localhost:3000` and your production URL.

### Scripts

- `npm run dev` — start dev server
- `npm run build` — build (Turbopack)
- `npm run start` — run production build
- `npm run lint` — run ESLint

### Deploy (Vercel)

- Import the repo on Vercel
- Add Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Optional: `NEXT_PUBLIC_SITE_URL` set to your domain (e.g., https://yourdomain.com)
- Deploy and enjoy 🌊

### Security headers

The app sets standard security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) in `next.config.ts`. If your Supabase URL changes, rebuild to refresh the CSP allowlist.

### Private Preview (Password Gate)

This repo includes a site-wide Basic Auth gate implemented via Next.js Middleware. It is intended for preview/private launches.

How it works

- When `PREVIEW_LOCK=1`, every route (except static assets and allowed webhooks) requires a username/password.
- Credentials come from `BASIC_AUTH_USER` and `BASIC_AUTH_PASS`.
- Static assets and Next internals are not gated so CSS/JS/images load.
- `/api/stripe/webhook` remains reachable for webhooks.
- While locked, we additionally send `X-Robots-Tag: noindex, nofollow` and return a robots file that disallows crawling, and an empty sitemap.

Configure on Vercel

1) Add environment variables in Vercel → Project → Settings → Environment Variables (Preview and Production):

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `PREVIEW_LOCK=1`
   - `BASIC_AUTH_USER=preview`
   - `BASIC_AUTH_PASS=<strong password>`

2) Redeploy both Preview and Production environments.

3) In Supabase → Authentication → URL Configuration, set:

   - Site URL: your Vercel Production URL (e.g., `https://yourdomain.com`)
   - Additional Redirect URLs: your Vercel Preview URL (e.g., `https://your-project.vercel.app`) so auth redirects work.

Unlock later

- To remove the lock, set `PREVIEW_LOCK=0` (or remove it) and redeploy. Robots and headers revert to normal, and the sitemap will include URLs again.

### Troubleshooting (Windows / Dev)

- ENOENT opening `.next/static/development/_buildManifest.js.tmp.*` during `npm run dev` usually means the dev server attempted to read a temp file that was deleted or never created due to a watcher hiccup.
- Fixes:
  1) Stop dev server. Delete `.next` completely, then restart:
     - PowerShell: `Remove-Item -Recurse -Force .next`
     - Bash: `rm -rf .next`
  2) Try the non‑Turbopack dev server which is more forgiving: `npm run dev:plain`.
  3) If you’re on Windows, enable polling to avoid missed FS events:
     - PowerShell: `$env:WATCHPACK_POLLING="true"; npm run dev:plain`
  4) Ensure antivirus/OneDrive isn’t locking files under your project. Add an exclusion if needed.
  5) Avoid spaces in the project path if possible (e.g., rename folder to `Linket-Web-Development`).
  6) Don’t delete `.next` while the dev server is running; always stop dev first.
