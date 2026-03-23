# Billing System Deep Dive

This document explains the billing implementation in this repository end-to-end:

- Product pricing model and plan semantics
- Stripe + Supabase architecture
- Database schema used by billing
- API endpoints and request/response behavior
- Webhook event handling and side effects
- Dashboard billing UI behavior
- Loyalty and complimentary-window logic
- Security, idempotency, and troubleshooting

This is based on the current implementation in:

- `src/lib/billing/*`
- `src/lib/stripe.ts`
- `src/app/api/billing/*`
- `src/app/api/stripe/webhook/route.ts`
- `src/components/dashboard/billing/*`
- `src/app/dashboard/billing/page.tsx`
- `supabase/migrations/*` billing-related files

---

## 1. Billing Product Model

The public pricing model is hardcoded in `src/lib/billing/pricing.ts`.

### 1.1 Individual plans

- `Free Web-Only`
  - `monthly: 0`
  - label: `free + limited features`
- `Web + Linket Bundle`
  - one-time charge: `$59`
  - includes `12` months of Pro entitlement
  - complimentary period starts when Linket is **claimed**, not at checkout
- `Paid Web-Only (Pro)`
  - initial rates:
    - monthly: `$7`
    - yearly: `$70`
  - loyalty discount:
    - name: `Loyalty discount`
    - required duration: `365 paid days` (also shown as `12 months`)
    - loyalty rates:
      - monthly: `$6`
      - yearly: `$60`

### 1.2 Business pricing (display pricing only)

- Generic:
  - minimum units: `5`
  - one-time hardware per Linket: `$39`
  - software per user monthly: `$6`
- Custom:
  - minimum units: `5`
  - one-time hardware range: `$49-$69`
  - setup one-time: `$499`
  - software per user monthly: `$6`

Business pricing is represented in UI copy but Stripe subscription accrual/loyalty logic is scoped to personal plan signals.

---

## 2. Environment Variables

Billing behavior depends on these env vars.

### 2.1 Required for Stripe server operations

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

If `STRIPE_SECRET_KEY` is missing, most billing APIs redirect/return unavailable responses.
If `STRIPE_WEBHOOK_SECRET` is missing, webhook endpoint returns 503.

### 2.2 Stripe price and shipping configuration

- Personal Pro:
  - `STRIPE_PERSONAL_PRO_MONTHLY_PRICE_ID` (optional, preferred monthly ID)
  - `STRIPE_PERSONAL_PRO_YEARLY_PRICE_ID` (optional, preferred yearly ID)
  - `STRIPE_PERSONAL_PRO_PRICE_IDS` (CSV fallback list and loyalty price allowlist)
- Bundle:
  - `STRIPE_WEB_PLUS_LINKET_BUNDLE_PRICE_ID` (preferred)
  - `STRIPE_LINKET_BUNDLE_PRICE_ID` (legacy fallback)
  - `STRIPE_LINKET_BUNDLE_SHIPPING_RATE_IDS` (CSV, preferred)
  - legacy shipping fallback:
    - `STRIPE_LINKET_BUNDLE_STANDARD_SHIPPING_RATE_ID`
    - `STRIPE_LINKET_BUNDLE_EXPRESS_SHIPPING_RATE_ID`
  - `STRIPE_LINKET_BUNDLE_ALLOWED_SHIPPING_COUNTRIES` (CSV ISO country codes, default `US`)

### 2.3 Client Stripe

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - used by `BrandedCardEntry` (Stripe Elements setup intent flow)

### 2.4 Site/Supabase

- `NEXT_PUBLIC_SITE_URL` (used for absolute billing URLs and redirect callbacks)
- `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`
  - needed for admin client; if unavailable, some billing features degrade or return unavailable

---

## 3. High-Level Architecture

### 3.1 Core services

- Stripe:
  - checkout sessions (subscription + one-time bundle)
  - billing portal sessions
  - setup intents + payment methods
  - invoices/subscriptions/customers
- Supabase:
  - stores normalized billing records:
    - period windows
    - billing events/warnings
    - bundle orders/purchases
  - stores `stripe_customer_id` on `user_profiles`

### 3.2 Core files

- Stripe config/client helpers:
  - `src/lib/stripe.ts`
- Billing aggregation and customer resolution:
  - `src/lib/billing/dashboard.ts`
- Loyalty computation:
  - `src/lib/billing/loyalty.ts`
- Complimentary window computation:
  - `src/lib/billing/linket-bundle.ts`
- Complimentary no-charge enforcement:
  - `src/lib/billing/complimentary-subscription.ts`
- Main Stripe webhook processor:
  - `src/app/api/stripe/webhook/route.ts`

### 3.3 Read path vs write path

- Read path (dashboard page):
  - `getDashboardBillingDataForUser` aggregates Stripe + Supabase + complimentary window + warnings
  - rendered by `BillingContent`
- Write path:
  - checkout/portal/payment-method endpoints call Stripe directly
  - webhook writes canonical transaction history into Supabase tables

---

## 4. Database Schema Used by Billing

## 4.1 `public.subscription_billing_periods`

Migration: `20260224000000_stripe_subscription_billing_periods.sql`

Purpose:

- Canonical normalized paid/refunded/voided subscription windows for a user.

Key columns:

- `user_id` (FK to `auth.users`)
- `provider` (`stripe`)
- `provider_customer_id`
- `provider_subscription_id`
- `status` (`paid`, `refunded`, `voided`)
- `period_start`, `period_end` (timestamptz, with `period_end > period_start`)
- `source_event_id` (Stripe event ID)
- `metadata` (JSONB)

Important constraints/indexes:

- unique by provider+subscription+period window+status
- index by user and period
- paid lookup index by `(user_id, provider, status, period_start)`

RLS:

- enabled
- authenticated users get `SELECT` only for rows where `user_id = auth.uid()`

## 4.2 `public.subscription_billing_events`

Migration: `20260225020000_subscription_billing_events.sql`

Purpose:

- Stores warning/error/info lifecycle events (e.g., failed invoice payment, subscription state transitions), later surfaced in dashboard as warnings.

Key columns:

- `user_id`
- `provider_customer_id`
- `provider_subscription_id`
- `event_type`
- `source_event_id` (unique per provider)
- `status` (`info`, `warning`, `error`)
- `occurred_at`
- `metadata` JSONB

RLS:

- enabled
- authenticated users get `SELECT` only for own rows

## 4.3 `public.orders`

Migration: `20260225000000_orders_and_bundle_purchases.sql`

Purpose:

- One row per Stripe bundle checkout session (order-level info and totals).

Key columns:

- `provider_checkout_session_id` (unique with provider)
- `status` (`pending`, `paid`, `refunded`, `canceled`)
- money fields in minor units:
  - `subtotal_minor`, `tax_minor`, `shipping_minor`, `total_minor`
- `receipt_url`
- `metadata` JSONB

RLS:

- enabled
- authenticated users can `SELECT` own rows

## 4.4 `public.bundle_purchases`

Migration: `20260225000000_orders_and_bundle_purchases.sql`

Purpose:

- Bundle-purchase detail row tied to `orders`.

Key columns:

- `order_id` FK to `orders`
- Stripe references:
  - `provider_checkout_session_id`
  - `provider_customer_id`
  - `provider_payment_intent_id`
  - `provider_invoice_id`
  - `bundle_price_id`
- `purchase_status` (`pending`, `paid`, `refunded`, `canceled`)
- shipping fields:
  - `shipping_rate_id`
  - `shipping_name`
  - `shipping_phone`
  - `shipping_address` JSONB
- `metadata` JSONB

RLS:

- enabled
- authenticated users can `SELECT` own rows

## 4.5 `public.user_profiles.stripe_customer_id`

Migration: `20260225010000_user_profiles_stripe_customer_id.sql`

Purpose:

- Fast Stripe customer lookup without recalculating from periods/subscriptions.

Behavior:

- adds `stripe_customer_id` column
- adds useful indexes
- backfills from latest `subscription_billing_periods.provider_customer_id`

## 4.6 `public.tag_events` dependency

Complimentary-window calculation depends on `tag_events` claim events:

- looked up by `event_type = "claim"`
- metadata fields checked:
  - `entitlement_user_id` (preferred)
  - `user_id` (legacy fallback)

The billing code does not create this table; it assumes existing Linket schema and handles missing-relation errors gracefully by degrading to `source: "unavailable"`.

---

## 5. Security and Request Validation

### 5.1 Auth

Most billing APIs call `createServerSupabase().auth.getUser()` and require authenticated user:

- return `401` for JSON endpoints
- or redirect to `/auth?view=signin&next=...` for redirect-style endpoints

### 5.2 Origin validation (`isTrustedRequestOrigin`)

Used by billing POST/GET actions to block cross-origin misuse.

Trust rules:

- request `origin` matches runtime/configured site origin, or
- `referer` origin matches, or
- missing origin+referer with `sec-fetch-site` same-origin/same-site, or
- CSRF header matches CSRF cookie.

### 5.3 CSRF

- cookie: `linket_csrf`
- header: `x-linket-csrf`
- cookie is created by middleware/proxy for dashboard/auth/profile/admin paths.

### 5.4 Service role dependency

`isSupabaseAdminAvailable` is checked in critical places:

- webhook returns 503 if unavailable
- some data fetch functions degrade to empty/unavailable state

---

## 6. Stripe Helper Layer (`src/lib/stripe.ts`)

### 6.1 Exposed helpers

- `getStripeSecretKey`
- `getStripeWebhookSecret`
- `getStripeServerClient` (singleton Stripe client)
- price/shipping helpers:
  - `getPersonalProPriceIds`
  - `getPersonalProPriceIdForInterval(month|year)`
  - `getLinketBundlePriceId`
  - `getLinketBundleShippingRateIds`
  - `getLinketBundleAllowedShippingCountries`

### 6.2 Interval ID selection

For Pro subscriptions:

- uses explicit monthly/yearly env first
- otherwise falls back to CSV list order:
  - first as monthly
  - second (or first) as yearly

---

## 7. Complimentary Window and Loyalty Logic

## 7.1 Complimentary window (`linket-bundle.ts`)

`getLinketBundleComplimentaryWindowForUser(userId)` returns:

- `eligible`
- `startsAt`, `endsAt`
- `active`
- `startsInDays`, `daysRemaining`
- `includedMonths`
- `source`

How it computes:

1. Reads earliest claim event from `tag_events` metadata (`entitlement_user_id`, then legacy `user_id`).
2. If user had an already-active paid period covering claim time, window starts at that paid period's `period_end` (deferred start).
3. Window length = `includesProMonths` from public pricing (currently 12 months).
4. Calculates active/upcoming timing fields.

## 7.2 No-charge enforcement (`complimentary-subscription.ts`)

`ensureNoChargeDuringComplimentary`:

- retrieves subscription
- applies `pause_collection`:
  - `behavior: "void"`
  - `resumes_at`: complimentary end
- uses idempotency key:
  - `complimentary-no-charge:<subscriptionId>:<resumesAt>`
- stores metadata flags:
  - `complimentary_no_charge`
  - `complimentary_pause_source`
  - window timestamps

This is called from:

- `/api/billing/subscribe` when manageable sub already exists
- `/api/stripe/webhook` for subscription updates/upcoming invoices
- `/api/linkets/claim` after successful claim

## 7.3 Loyalty computation (`loyalty.ts`)

`getPersonalProLoyaltyStatusForUser(userId)`:

1. Reads `subscription_billing_periods` with status `paid`.
2. Converts windows to intervals and merges overlaps.
3. Subtracts complimentary windows:
   - current computed complimentary window (`linket-bundle.ts`)
   - plus any period metadata where `complimentary_window_active=true`
4. Sums effective paid milliseconds/days.
5. Determines:
   - `eligible` if total >= required paid days
   - `eligibleOn`
   - `daysUntilEligible` (projected only while actively paid now)
6. Returns full `PersonalProLoyaltyStatus`.

If billing-period table unavailable, returns `null` (unavailable state).

---

## 8. Billing API Endpoints

All live under `src/app/api/billing/*` unless noted.

Runtime notes:

- mutating/Stripe-backed billing routes run with:
  - `runtime = "nodejs"`
  - `dynamic = "force-dynamic"`
- pricing route also sets:
  - `dynamic = "force-dynamic"`

## 8.1 `GET|POST /api/billing/subscribe`

Purpose:

- Start Pro subscription checkout (`interval=month|year`) or reroute existing subscribers to plan-update portal flow.

Behavior:

- validates origin
- requires auth; if not authenticated, redirects to signin with:
  - `intent=pro_monthly|pro_yearly`
  - `resume=subscribe`
- verifies Stripe configured and price ID exists
- resolves/creates Stripe customer
- if manageable subscription already exists:
  - enforces complimentary no-charge pause when eligible
  - redirects to Stripe Billing Portal `subscription_update` flow
- otherwise creates Stripe Checkout subscription session
  - `allow_promotion_codes: true`
  - metadata includes `user_id`, scope fields
  - may set `subscription_data.trial_end` to complimentary end
  - idempotency key:
    - `billing-subscribe:<userId>:<interval>:<priceId>:<30s_slot>`

Redirect outcomes:

- checkout URL on success
- `/dashboard/billing?billingError=...` on failures

## 8.2 `GET|POST /api/billing/bundle-checkout`

Purpose:

- Start one-time Web + Linket Bundle checkout with shipping and automatic tax.

Behavior:

- validates origin
- requires auth; if not authenticated, redirects with:
  - `intent=bundle`
  - `resume=bundle_checkout`
- validates bundle price + shipping configuration
- resolves/creates Stripe customer
- creates Stripe Checkout payment session with:
  - `mode: payment`
  - card-only payment type
  - Link wallet disabled (`wallet_options.link.display="never"`)
  - shipping address collection
  - shipping options from configured shipping rates
  - automatic tax enabled
  - invoice creation enabled
  - metadata includes:
    - `purchase_type=web_plus_linket_bundle`
    - purchaser/entitlement metadata:
      - `user_id`
      - `purchaser_user_id`
      - `plan_scope=personal`
      - `entitlement_start=linket_claim`
      - `entitlement_owner=claimer_user`
      - `giftable=true`
  - invoice metadata includes:
    - `user_id`
    - `supabase_user_id`
    - `purchaser_user_id`
    - `plan_scope=personal`
    - `purchase_type=web_plus_linket_bundle`
    - `entitlement_owner=claimer_user`
    - `giftable=true`
- idempotency key:
  - `billing-bundle:<userId>:<priceId>:<30s_slot>`

Success redirect:

- `/dashboard/billing?checkout=processing&purchase=bundle&session_id={CHECKOUT_SESSION_ID}`

Cancel redirect:

- `/dashboard/billing?checkout=incomplete&purchase=bundle`

Tax setup special handling:

- maps Stripe automatic-tax setup errors to:
  - `billingError=bundle_tax_configuration_required`

## 8.3 `GET /api/billing/bundle-session-status`

Purpose:

- Poll Stripe checkout session lifecycle for bundle payments.

Input:

- query `session_id` (`cs_...` required)

Auth:

- requires authenticated user

Authorization:

- user must match either:
  - session metadata user fields
  - or `client_reference_id`

Output:

- JSON with:
  - `status`: `processing` | `paid` | `failed`
  - Stripe status fields
  - `receiptUrl` if derivable

Lifecycle mapping logic:

- `paid` when Stripe checkout `payment_status` is:
  - `paid`, or
  - `no_payment_required`
- `failed` when:
  - checkout status is `expired`, or
  - payment intent status is `canceled` or `requires_payment_method`
- otherwise returns `processing`

## 8.4 `GET|POST /api/billing/portal`

Purpose:

- Open Stripe billing portal.
- Optional plan flow with `?flow=plan` to jump directly into subscription update.

Behavior:

- validates origin
- auth redirect if not logged in:
  - back to `/dashboard/billing?resume=portal|portal_plan`
- verifies Stripe configured
- resolves customer
- builds billing portal session
  - default flow, or
  - `subscription_update` flow if `flow=plan`
- if `flow=plan` but no manageable subscription:
  - redirects to billing page with `intent=pro_monthly`

Idempotency:

- `billing-portal:<customerId>:<flow|default>:<30s_slot>`

## 8.5 `POST /api/billing/subscription/cancel`

Purpose:

- Self-service cancel at period end.

Behavior:

- validates origin
- requires auth
- verifies Stripe configured
- resolves customer
- finds manageable subscription by priority status
- if already canceled or `cancel_at_period_end=true`, just redirects with notice
- otherwise updates subscription:
  - `cancel_at_period_end: true`
  - metadata tracks cancellation request source/time/user

Redirect:

- `/dashboard/billing?subscription=cancel_scheduled`

## 8.6 `POST /api/billing/setup-intent`

Purpose:

- Create SetupIntent for secure card entry.

Behavior:

- validates origin
- requires auth
- verifies Stripe configured
- resolves customer
- creates setup intent:
  - `usage: off_session`
  - `payment_method_types: ["card"]`
  - metadata includes user/source

JSON response:

- `{ clientSecret, setupIntentId, customerId }`

## 8.7 `POST /api/billing/payment-method/default`

Purpose:

- Set default payment method for customer and active subscriptions.

Behavior:

- validates origin
- requires auth
- verifies Stripe configured
- validates `paymentMethodId` format (`pm_...`)
- resolves customer
- verifies payment method belongs to customer
- updates customer `invoice_settings.default_payment_method`
- updates all subscriptions in statuses:
  - `trialing`, `active`, `past_due`, `unpaid`, `incomplete`, `paused`

Response:

- `{ ok: true }` on success

## 8.8 `POST /api/billing/payment-method/remove`

Purpose:

- Remove/detach card from Stripe customer.

Behavior:

- validates origin
- requires auth
- verifies Stripe configured
- validates `paymentMethodId`
- resolves customer
- verifies ownership of payment method
- finds replacement card if needed
- blocks removal when:
  - no replacement exists
  - and a manageable subscription exists
- if removing default:
  - switches customer default to replacement (or clears)
- updates subscriptions using removed method to replacement/undefined
- detaches payment method

Response:

- `{ ok: true }` on success

## 8.9 `GET /api/billing/pricing`

Purpose:

- Return public pricing snapshot + personal loyalty status for logged-in users.

Response:

- unauthenticated: `{ pricing, personalProLoyalty: null }`
- authenticated: `{ pricing, personalProLoyalty }`

---

## 9. Stripe Webhook (`/api/stripe/webhook`)

File: `src/app/api/stripe/webhook/route.ts`

### 9.1 Preconditions

- requires Supabase admin availability
- requires `STRIPE_WEBHOOK_SECRET`
- verifies `stripe-signature` header
- constructs event with `stripe.webhooks.constructEvent(...)`
- runs with:
  - `runtime = "nodejs"`
  - `dynamic = "force-dynamic"`

### 9.2 Events handled

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `invoice.paid`
- `invoice.payment_succeeded`
- `invoice.upcoming`
- `invoice.voided`
- `invoice.payment_failed`
- `charge.refunded`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 9.3 Bundle checkout completion flow

On completed/async success payment sessions:

- only processes when:
  - session mode is `payment`
  - `metadata.purchase_type=web_plus_linket_bundle`
- resolves user ID from session metadata/client reference/customer metadata
- resolves receipt URL from invoice/payment intent/charge
- resolves shipping details from:
  - checkout session
  - refreshed session
  - customer fallback
- upserts `orders`
- upserts `bundle_purchases`

On async payment failed:

- marks matching order/purchase as `canceled`.

### 9.4 Subscription period ledger flow

`invoice.paid` / `invoice.payment_succeeded`:

- collects subscription period windows from invoice lines (or invoice-level fallback)
- resolves user ID from metadata and fallback lookups
- computes loyalty-eligibility signal for invoice
- enriches metadata with complimentary-window state
- if complimentary invoice during active window and personal price IDs configured:
  - attempts refund (idempotent by invoice ID)
- else inserts `paid` period rows into `subscription_billing_periods`
- if loyalty not eligible (business/excluded), paid-period upsert is skipped

Loyalty eligibility signal (`isInvoiceEligibleForPersonalLoyalty`) details:

- if `STRIPE_PERSONAL_PRO_PRICE_IDS` is configured:
  - only invoices containing those price IDs are eligible
- if that env var is empty:
  - metadata heuristics are used first:
    - scope-like fields in invoice/subscription/customer metadata
    - business-like values (`business`, `enterprise`, `team`) => excluded
    - personal-like values (`personal`, `individual`) => eligible
  - then line-item text heuristics:
    - business keywords => excluded
    - personal/pro keywords => eligible
  - final fallback defaults to eligible when no exclusion signal is found

`invoice.voided`:

- converts matching `paid` windows to `voided` (or inserts voided row if paid row missing).

`charge.refunded`:

- only acts on full refunds
- marks matching bundle order/purchase refunded by invoice ID
- fetches invoice and converts periods to `refunded`
- partial refunds are explicitly acknowledged but do **not** convert billing periods to `refunded`

### 9.5 Billing warning/event ledger flow

`invoice.payment_failed`:

- writes warning/error into `subscription_billing_events` with rich metadata:
  - amounts
  - attempt count
  - next attempt timestamp
  - invoice/PI/charge references

`customer.subscription.updated` / `deleted`:

- writes event row with severity mapping:
  - `unpaid` / `incomplete_expired` => error
  - `past_due` / `incomplete` / `canceled` => warning
  - otherwise info
- on `updated`, also enforces complimentary no-charge pause when eligible

### 9.6 Upcoming invoice safety

`invoice.upcoming`:

- if invoice maps to an eligible complimentary window, proactively enforces pause on the subscription to prevent charge.

### 9.7 Idempotency and conflict strategy

- period rows: `upsert` with unique window+status conflict key
- event rows: `upsert` on `(provider, source_event_id)`
- bundle rows: `upsert` on `(provider, provider_checkout_session_id)`
- refund calls use idempotency key by invoice ID

### 9.8 Missing-table resilience

For relation/schema-cache errors, webhook logs warnings and skips affected writes rather than crashing all processing.

---

## 10. Billing Dashboard Data Aggregation (`getDashboardBillingDataForUser`)

File: `src/lib/billing/dashboard.ts`

What it aggregates:

- complimentary window
- bundle orders + purchases
- subscription billing periods
- warning events
- Stripe live data:
  - customer
  - subscription
  - payment methods
  - invoices

### 10.1 Stripe customer resolution strategy

Priority:

1. `user_profiles.stripe_customer_id`
2. customer ID from stored period rows
3. customer from Stripe subscription lookup
4. search Stripe customers by metadata `user_id`
5. exact metadata match from Stripe list-by-email fallback
6. safe adoption of a single unbound email-matched customer on write flows
7. create customer with metadata `user_id` + `supabase_user_id`

Safety rules:

- persisted `stripe_customer_id` values are re-validated against live Stripe customer metadata before they are trusted
- stale or mismatched persisted customer bindings are cleared instead of being reused
- unbound Stripe customers are only adopted when the authenticated user's email matches the Stripe customer email

### 10.2 Billing summary fields

Summary includes:

- plan name
- status
- current period range
- renews on
- auto renew toggle
- active subscription ID
- manageable subscription ID
- customer ID
- counts of paid/refunded/voided windows

Status fallback order:

- active Stripe subscription status
- else `complimentary` if window active
- else `active` if active paid period row exists
- else `inactive` if paid history exists
- else `free`

### 10.3 Warnings synthesis

`subscription_billing_events` rows are deduped by billing target (subscription/customer/event fallback), then only warning/error severities are retained and mapped to user-facing warning messages.

---

## 11. Billing Page and UI Behavior

## 11.1 Page entry

File: `src/app/dashboard/billing/page.tsx`

Reads and normalizes query params:

- `checkout`: `success|cancel|incomplete|processing`
- `purchase`: currently only `bundle`
- `session_id`
- `billingError`
- `intent`: `bundle|pro_monthly|pro_yearly`
- `resume`: `subscribe|bundle_checkout|portal|portal_plan`
- `subscription`: `cancel_scheduled`

Then loads:

- `pricing`
- `personalProLoyalty`
- `billingData`

## 11.2 Billing page component

File: `src/components/dashboard/billing/BillingContent.tsx`

Major sections:

- transient banners for checkout lifecycle, errors, subscription notices
- plan overview card + manage/adjust plan CTA
- payment methods card (add/set-default/remove)
- billing health card (period counts + Stripe sync warnings)
- personal loyalty discount card + progress
- bundle orders card (shipping, receipt, tracking metadata)
- invoices card
- billing period history card
- cancellation controls

## 11.3 Transient URL state cleaner

File: `BillingTransientStateCleaner.tsx`

Auto-removes transient query params after delays:

- billing errors: ~9s
- checkout success/cancel/incomplete: ~10s
- processing states: ~12s

## 11.4 Bundle status poller

File: `BundlePaymentStatusPoller.tsx`

- starts polling after 10s delay
- polls every 8s
- endpoint: `/api/billing/bundle-session-status`
- on `paid`: waits for persisted order state, then clears transient params and refreshes
- on `failed`: refreshes page and shows retry link

## 11.5 Card entry flow

File: `BrandedCardEntry.tsx`

Flow:

1. User clicks `Add card` to lazily initialize secure field.
2. Loads Stripe.js using `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
3. Calls `/api/billing/setup-intent`.
4. Renders Stripe `CardElement`.
5. On submit:
   - `stripe.confirmCardSetup(clientSecret)`
   - extracts `paymentMethodId`
   - calls `/api/billing/payment-method/default`
6. Refreshes page and shows toast.

Notes:

- card input styling is theme-aware via CSS variables
- shows slow-load warning after 10 seconds
- code explicitly states raw PAN/CVC is never processed by Linket servers

---

## 12. Query Params and User Journeys

## 12.1 Intent + resume handoff

Landing CTAs deep-link to auth with `next=/dashboard/billing?intent=...`.

When unauthenticated users hit billing APIs, routes redirect to auth and preserve intent/resume:

- `resume=subscribe`
- `resume=bundle_checkout`
- `resume=portal`
- `resume=portal_plan`

## 12.2 Checkout and purchase flags

Bundle success flow uses:

- `checkout=processing`
- `purchase=bundle`
- `session_id=cs_...`

Billing page turns these into status banners and polling behavior.

## 12.3 Billing error code mapping

`BillingContent` maps `billingError` query values to specific user-facing messages, including:

- Stripe unavailable
- missing pricing config
- missing bundle shipping config
- tax config required
- invalid request origin
- no active subscription, etc.

---

## 13. Billing Tables: Ownership and Write Model

Authenticated users can generally read their own billing records via RLS.

Writes are primarily from server-side privileged code:

- webhook upserts events/periods/orders/purchases
- customer ID persistence updates `user_profiles`

This design keeps billing integrity centralized and avoids client-side direct table writes.

---

## 14. Operational and Troubleshooting Notes

## 14.1 Common unavailable conditions

- Missing `STRIPE_SECRET_KEY`
  - APIs redirect or return unavailable
- Missing `STRIPE_WEBHOOK_SECRET`
  - webhook endpoint returns 503
- Missing `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - card entry UI unavailable
- Missing Supabase service role
  - webhook unavailable
  - some admin-backed billing reads degrade

## 14.2 Why bundle might show "processing"

- async payment methods can settle later
- `bundle-session-status` polling continues until paid/failed
- if `session_id` is missing in URL, UI cannot auto-verify and asks user to restart

## 14.3 Why loyalty data can be unavailable

- `subscription_billing_periods` relation missing/unmigrated
- admin client unavailable in environment

## 14.4 Complimentary refund caveat

Automatic refund for complimentary invoices requires `STRIPE_PERSONAL_PRO_PRICE_IDS` configured.
If empty, webhook logs and skips complimentary invoice refund path.

## 14.5 Duplicate event safety

Webhook and order writes are designed with `upsert`/idempotency patterns to be safe against retries and duplicate Stripe deliveries.

## 14.6 Preview lock webhook caveat

When preview Basic Auth lock is enabled (`PREVIEW_LOCK=1`), middleware still allows
`/api/stripe/webhook` so Stripe can continue delivering events while the app is private.

---

## 15. Current Limitations and Implementation Notes

- Billing API folders `checkout`, `manage`, `summary`, and `reminders/run` exist as directories but do not currently expose route handlers.
- Loyalty accrual is based on normalized Stripe period rows and is explicitly personal-scope oriented.
- Tracking/fulfillment fields shown in bundle orders are read from metadata keys; there is no dedicated billing API in this code to manage shipment updates.
- dashboard reads no longer adopt unbound Stripe customers by email.
- write flows may safely adopt a single unbound Stripe customer when the email match is unique, then persist the binding on `user_profiles`.

---

## 16. File-by-File Reference

- Pricing and labels: `src/lib/billing/pricing.ts`
- Stripe env/config helper: `src/lib/stripe.ts`
- Complimentary window resolver: `src/lib/billing/linket-bundle.ts`
- Loyalty computation: `src/lib/billing/loyalty.ts`
- Complimentary pause helper: `src/lib/billing/complimentary-subscription.ts`
- Dashboard billing aggregation: `src/lib/billing/dashboard.ts`
- Billing page loader: `src/app/dashboard/billing/page.tsx`
- Billing UI: `src/components/dashboard/billing/BillingContent.tsx`
- Stripe card entry UI: `src/components/dashboard/billing/BrandedCardEntry.tsx`
- Action button wrappers:
  - `BillingStripeActionButton.tsx`
  - `SetDefaultPaymentMethodButton.tsx`
  - `RemovePaymentMethodButton.tsx`
  - `BundlePaymentStatusPoller.tsx`
  - `BillingTransientStateCleaner.tsx`
- Billing APIs:
  - `src/app/api/billing/subscribe/route.ts`
  - `src/app/api/billing/bundle-checkout/route.ts`
  - `src/app/api/billing/bundle-session-status/route.ts`
  - `src/app/api/billing/portal/route.ts`
  - `src/app/api/billing/subscription/cancel/route.ts`
  - `src/app/api/billing/setup-intent/route.ts`
  - `src/app/api/billing/payment-method/default/route.ts`
  - `src/app/api/billing/payment-method/remove/route.ts`
  - `src/app/api/billing/pricing/route.ts`
- Webhook processor:
  - `src/app/api/stripe/webhook/route.ts`
- Claim integration that triggers complimentary enforcement:
  - `src/app/api/linkets/claim/route.ts`
- Billing migrations:
  - `supabase/migrations/20260224000000_stripe_subscription_billing_periods.sql`
  - `supabase/migrations/20260225000000_orders_and_bundle_purchases.sql`
  - `supabase/migrations/20260225010000_user_profiles_stripe_customer_id.sql`
  - `supabase/migrations/20260225020000_subscription_billing_events.sql`
