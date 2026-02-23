# Linket Pricing Specification

Last updated: 2026-02-19
Owner: Product + Engineering

## 1) Pricing Overview

This document defines the canonical pricing and entitlement behavior for Linket.

### 1.1 Plan Matrix

| Offer | Plan Key | Billing Type | Price (USD) | Checkout in App | Renewal |
|---|---|---|---:|---|---|
| Free Web-Only | `free` | Free | $0 | No | N/A |
| Pro Monthly (Personal) | `pro_monthly` | Subscription (monthly) | $7/month | Yes | Auto-renew |
| Pro Yearly (Personal) | `pro_yearly` | Subscription (yearly) | $70/year | Yes | Auto-renew |
| Web + Linket Bundle | `bundle_59` | One-time payment + entitlement | $59 one-time | Yes | No auto-renew |
| Business Generic | N/A | Sales-led | Contact sales | No | Contract/manual |
| Custom Design Add-On | N/A | Sales-led/manual invoice | Contact sales | No | Manual |

### 1.2 Geography and Currency

- Market: United States
- Currency: USD only
- Tax: Stripe Tax enabled

## 2) Feature Access by Plan

### 2.1 Free Plan (`free`)

- Analytics: locked (user sees promo/demo experience only)
- Published links: max 3 public links
- Link creation: unlimited draft links allowed
- Extra links beyond 3: preserved, but cannot be publicly visible on free
- Themes: `light` and `dark` only
- Lead form fields: limited to `Name`, `Email`, and `Phone Number` (short text class)

### 2.2 Paid Plans (`pro_monthly`, `pro_yearly`, `bundle_59`, valid Linket offer entitlement)

- Full analytics access
- Full theme access
- Full lead form field library
- No free-tier published-link cap enforcement

## 3) Bundle and Linket Offer Rules

### 3.1 Bundle Purchase (`bundle_59`)

- One-time checkout payment
- Includes 12 months of Pro entitlement
- Does not auto-renew
- Checkout collects US shipping address, phone number, and shipping rate selection (Standard or Expedited)

### 3.2 Linket Claim-Based 12-Month Pro Offer

- Offer is tied to a physical Linket tag
- A Linket can grant the 12-month Pro offer once total
- Claim is recorded in `public.linket_pro_offer_claims`
- If tag is released and reclaimed later, offer is not shown again
- Entitlement source type: `linket_offer`

## 4) Discounted Pro Eligibility

- Discounted Pro Monthly (Personal) price: **$6/month**
- Discounted Pro Yearly (Personal) price: **$60/year**
- Discounted Pro pricing becomes available only after user has accumulated 12 total months on paid subscription plans
- Paid months do not need to be consecutive
- User can select discounted renewal only after eligibility is met
- Eligibility logic is independent from bundle/linket one-time offer logic
- Discounted pricing is offered as a renewal/loyalty option only, not as a default first-time purchase price
- Standard and discounted Pro rates in this section apply to **personal, non-business use**

## 5) Upgrade / Downgrade Behavior

### 5.1 Upgrade

- Feature gates are removed according to paid entitlement
- Existing content remains intact

### 5.2 Downgrade to Free

- Do not delete links or profile content
- Enforce free-tier visibility and feature limits
- Only 3 links can remain publicly visible
- Analytics and premium theme/form features become unavailable

## 6) Reminder and Renewal Behavior

- Reminder window: 30 days before bundle/linket entitlement end
- Reminder channels: in-app prompt and email
- Frequency: once per entitlement window in phase 1

## 7) Checkout and Auth Rules

- Checkout is auth-first
- Unauthenticated users must sign in/up before checkout starts
- Checkout entry points: landing pricing CTAs and dashboard billing/actions
- No promo codes in phase 1

## 8) Stripe Catalog Mapping

### 8.1 Required Stripe Objects (per mode: test and live)

- Price mapping:
- `STRIPE_PRICE_PRO_MONTHLY` -> `price_...` for $7 monthly recurring (personal)
- `STRIPE_PRICE_PRO_YEARLY` -> `price_...` for $70 yearly recurring (personal)
- `STRIPE_PRICE_BUNDLE_ONE_TIME` -> `price_...` for $59 one-time
- `STRIPE_PRICE_PRO_MONTHLY_DISCOUNTED` -> `price_...` for $6 monthly recurring (personal renewal)
- `STRIPE_PRICE_PRO_YEARLY_DISCOUNTED` -> `price_...` for $60 yearly recurring (personal renewal)
- Shipping rate mapping:
- `STRIPE_SHIPPING_RATE_STANDARD` -> `shr_...`
- `STRIPE_SHIPPING_RATE_EXPEDITED` -> `shr_...`

### 8.2 Required Environment Variables

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_YEARLY`
- `STRIPE_PRICE_PRO_MONTHLY_DISCOUNTED`
- `STRIPE_PRICE_PRO_YEARLY_DISCOUNTED`
- `STRIPE_PRICE_BUNDLE_ONE_TIME`
- `STRIPE_SHIPPING_RATE_STANDARD`
- `STRIPE_SHIPPING_RATE_EXPEDITED`

### 8.3 Required Webhook Events

- `checkout.session.completed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `charge.refunded`

## 9) Canonical Product Decisions

- Existing users default to free unless they purchase
- Business/custom offerings are sales-led in phase 1
- Hosted Stripe Checkout and Customer Portal are used (no embedded custom payment UI in phase 1)
