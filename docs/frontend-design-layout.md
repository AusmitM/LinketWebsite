# Frontend Design Layout

This document describes the current frontend layout system in the Linket website codebase. It focuses on how the UI is structured, which files own each visual surface, how responsive behavior works, and how the shared theme system connects marketing pages, auth, dashboard views, and public profiles.

## 1. Layout Model

The frontend is organized around one global app shell plus four major visual surfaces:

1. Marketing surface
   Routes such as `/`, `/digital-business-card`, `/nfc-business-card`, and `/link-in-bio`.
2. Auth surface
   Routes such as `/auth` and `/forgot-password`.
3. Dashboard surface
   All authenticated routes under `/dashboard/*`.
4. Public profile surface
   Live profile pages under `/[handle]` and authenticated preview pages under `/u/[handle]/preview`.

At the top level, `src/app/layout.tsx` provides the shared page frame for the whole app:

- registers the font stack
- loads global theme CSS
- renders the shared `Navbar`
- wraps page content in `<main id="main">`
- renders the shared `Footer`
- mounts global utility components such as analytics, toaster, service worker registration, and error logging

That means the app does not use separate root shells for marketing vs dashboard. Instead, the `Navbar` changes behavior based on the current route, and the dashboard introduces its own inner themed shell under `#dashboard-theme-scope`.

## 2. Route To Layout Ownership

| Surface | Main routes | Primary entry files | Layout owner |
| --- | --- | --- | --- |
| Global shell | all routes | `src/app/layout.tsx` | shared header, footer, fonts, global system UI |
| Landing page | `/` | `src/app/page.tsx` | custom long-form marketing layout |
| Discover pages | `/digital-business-card`, `/nfc-business-card`, `/link-in-bio` | route files under `src/app/*/page.tsx` | `src/components/site/marketing-page.tsx` |
| Auth | `/auth`, `/forgot-password` | `src/app/(auth)/auth/page.tsx`, `src/app/forgot-password/*` | dedicated page-level split layout |
| Dashboard | `/dashboard/*` | `src/app/dashboard/layout.tsx` | `src/components/dashboard/DashboardAppShell.tsx` |
| Profile editor | `/dashboard/profiles` | `src/app/dashboard/profiles/page.tsx` | `src/components/dashboard/public-profile/PublicProfileEditorPage.tsx` |
| Public profile live page | `/[handle]` | `src/app/[handle]/page.tsx` | page-level server layout plus shared profile components |
| Public profile preview | `/u/[handle]/preview` | `src/app/u/[handle]/preview/page.tsx` | `src/components/public/PublicProfilePreview.tsx` |

## 3. Shared Design System

### Typography

The app uses multiple fonts, each with a different visual job:

- `Geist` and `Geist Mono` are the default system fonts for general UI and code-style text.
- `Quicksand` is exposed as `--font-display` and is used for branded display moments.
- `Nunito` is exposed as `--font-landing` and is used heavily in dashboard and marketing content.
- `Averia Serif Libre` is exposed as `--font-landing-serif` and is used for the editorial headline treatment on the landing page.

Font registration lives in `src/app/layout.tsx`. Shared aliases are defined in `src/app/globals.css`.

### Tokens

The theme system starts in `src/styles/theme.css`, which imports:

- `src/styles/theme/base.css`
- `src/styles/theme/variants.css`

`base.css` defines the default semantic tokens:

- surfaces: `--background`, `--card`, `--popover`
- text: `--foreground`, `--muted-foreground`
- interaction: `--primary`, `--secondary`, `--accent`, `--ring`
- layout: `--radius`
- motion: `--duration-fast`, `--duration-base`, `--duration-slow`, `--ease-smooth`
- dashboard presentation: premium gradients, shadows, hairlines, and chrome tokens

`variants.css` remaps those same semantic tokens for each theme:

- `light`
- `dark`
- `midnight`
- `dream`
- `forest`
- `gilded`
- `rose`
- `autumn`
- `honey`
- `burnt-orange`
- `maroon`

The allowed theme names and dark-theme detection rules live in `src/lib/themes.ts`.

### Motion

Each surface has its own motion language:

- landing page: fade-up, fade-in, and float animations
- dashboard: navbar entrance, card hover lift, onboarding-tour transitions, save-state pulses
- public profile: staged content rise, backdrop fade, orb drift, image readiness transitions

Reduced-motion support is explicitly handled in the shared CSS for landing and public profile surfaces.

### Shape Language

The visual system strongly favors rounded geometry:

- buttons are often pill-shaped
- content cards commonly use `rounded-2xl`, `rounded-3xl`, or custom large radii
- mobile phone previews use an oversized rounded frame
- panels rely on soft borders, translucent fills, and blur instead of hard separators

## 4. Global Shell Behavior

The global shell is defined in `src/app/layout.tsx`.

### Header

The `Navbar` in `src/components/site/navbar.tsx` is route-aware:

- landing pages show anchor-based navigation
- discover pages show marketing route navigation
- auth pages show a simplified brand header
- dashboard pages show account controls, notifications, profile-sharing actions, and a mobile sidebar toggle
- the profile editor route adds a section pill navigator inside the top bar on medium and larger screens

This is an important architectural choice: header behavior is centralized, but visual content changes heavily depending on route type.

### Main Content

The root `<main>` is intentionally simple. Each route owns its own width, padding, and page rhythm rather than inheriting a rigid site-wide content container.

### Footer

The shared `Footer` is always mounted by the root layout. Marketing pages use it as a normal footer. Dashboard pages still inherit it from the root shell, but their main experience is visually dominated by the themed dashboard container.

## 5. Marketing Surface

### Landing Page

The landing page lives in `src/app/page.tsx`. It is not built from a generic page template. It is a custom, long-scroll story page with multiple section-specific treatments:

- hero with oversized editorial typography and gradient wordmark emphasis
- social proof and workflow sections
- an explore-pages section that routes users into SEO comparison pages
- a dark "customization" spotlight section
- a demo section
- a live public-profile preview section
- pricing
- FAQ
- custom landing footer

Layout characteristics:

- background anchored to warm `#fff7ed`
- sections usually constrained to `max-w-6xl`
- repeated use of centered copy plus asymmetrical two-column feature areas
- high use of gradients, blurs, large rounded panels, and hover lift

The page is intentionally more expressive than the rest of the app. It uses `landing-alt-font`, `landing-serif`, and staged entrance animation classes from `base.css`.

### Discover Pages

The discover pages use a much simpler structure through `src/components/site/marketing-page.tsx`.

That component standardizes:

- a top header block with kicker, title, subtitle, and optional CTA actions
- a centered content container with `max-w-6xl`
- stacked `PageSection` blocks below the page header

These pages are intentionally less visually dense than the landing page. They read more like structured marketing documents:

- top-level page header
- repeated content cards
- repeated comparison grids
- related-links section at the bottom

This creates a good split:

- `/` is the brand-heavy narrative landing page
- discover pages are controlled, SEO-friendly editorial layouts

## 6. Auth Surface

The auth experience is owned directly by `src/app/(auth)/auth/page.tsx`.

### Structure

The auth page uses a responsive split layout:

- mobile and tablet: single-column stack
- desktop: two-column grid with the form on the left and value-proposition cards on the right

The outer section uses:

- warm background tones matching the marketing palette
- large blurred color orbs
- a soft radial highlight overlay

### Left Column

The main auth card contains:

- compact top brand bar
- auth title and subtitle
- verification or error callouts
- email and password form
- password strength checklist on sign-up
- primary submit button
- forgot-password link on sign-in
- Google OAuth action
- route-switch link between sign-up and sign-in

### Right Column

The desktop-only aside reinforces the product visually with three stacked capability cards:

- unified theme
- smart links
- lead capture

This surface is intentionally softer and warmer than the dashboard. It acts as a bridge between the marketing palette and the authenticated product.

## 7. Dashboard Surface

The dashboard shell begins in `src/app/dashboard/layout.tsx`.

### Dashboard Layout Responsibilities

`src/app/dashboard/layout.tsx` does four important things:

- enforces authentication and redirects anonymous users to sign-in
- loads dashboard and public-profile theme CSS
- bootstraps the saved theme before hydration
- wraps dashboard content in `ThemeProvider`, session context, and `DashboardAppShell`

### Dashboard App Shell

`src/components/dashboard/DashboardAppShell.tsx` is the structural owner of the authenticated workspace.

Desktop behavior:

- full-height flex layout
- sticky left sidebar
- scrolling main content area
- content width capped at large breakpoint with generous horizontal padding

Mobile behavior:

- sidebar becomes a bottom sheet
- sheet opens over a dark overlay
- main content gets the full width

Special behavior:

- onboarding routes can hide the normal dashboard chrome
- users who still require onboarding are redirected into `/dashboard/get-started`

### Sidebar

`src/components/dashboard/Sidebar.tsx` controls the left navigation rail.

Its layout model:

- width is `200px` expanded or `72px` collapsed on desktop
- always expanded on mobile
- contains theme toggle near the top
- shows tooltip labels when collapsed
- appends admin-only routes when the current user is an admin

Primary dashboard nav items:

- Overview
- Public Profile
- Leads
- Analytics
- Billing
- Settings

Optional admin items:

- Minting
- Notifications

### Dashboard Chrome Styling

`src/styles/theme/dashboard.css` gives the dashboard a premium glass-and-gradient presentation:

- sticky navbar/topbar with blur and sheen
- pill-based nav groups
- animated active states
- elevated cards and tiles
- extensive small-screen tuning down to micro-phone widths

This file is not just decorative. It contains a large part of the dashboard's layout behavior at responsive breakpoints.

## 8. Public Profile Editor Layout

The public profile editor is the most complex single frontend page. It is mounted at `/dashboard/profiles` and owned by `src/components/dashboard/public-profile/PublicProfileEditorPage.tsx`.

### Core Layout Pattern

The page uses a two-part editing model:

- left side: section-specific editing panel
- right side: live phone preview with save state

Desktop layout:

- grid with `minmax(0,1fr)` editor column
- fixed-width `360px` preview column

Mobile layout:

- section switcher at the top using a rounded select
- preview becomes its own section instead of staying pinned beside the editor

### Editor Sections

The editor is split into five explicit sections:

- `profile`
- `contact`
- `links`
- `lead`
- `preview`

On larger screens, the top navbar exposes matching section pills. On smaller screens, the page uses a compact select input.

### Profile Section

The profile section is a stacked card containing:

- avatar uploader
- header image uploader
- logo uploader
- logo shape controls
- logo background toggle
- display name input
- headline textarea
- public handle field with prefixed host label

The profile card is intentionally linear and form-like. Media controls are broken up with divider lines so the page reads like one editing flow rather than separate subpages.

### Contact Section

The contact section reuses `VCardContent` in embedded mode. This keeps the contact-card editing model separate from the profile-card fields while still participating in the same autosave workflow.

### Links Section

The links section is more operational and management-focused. It includes:

- add-link CTA
- direct-to-link explanation panel
- search input
- sort dropdown
- draggable link rows in manual mode
- visibility toggle
- edit action
- delete action
- direct-to-link star toggle per row

This section also supports:

- autosaving edits
- toggling a single override link
- disabling reorder when the user is filtering or sorting

### Lead Section

The lead-form section mounts `LeadFormBuilder` in side layout with two columns and no duplicated preview. The live phone preview on the right acts as the visual feedback area.

### Preview Section

On mobile only, preview becomes a first-class section. This prevents the editor from feeling cramped and preserves the same phone-scale preview users see on desktop.

### Phone Preview Card

The preview itself is a `340px`-wide simulated phone shell:

- rounded frame
- gradient header image area
- avatar stack with optional logo badge
- display name and tagline
- primary "Save contact" CTA
- visible links list
- lead-form preview fields
- submit button

Notably, the preview is interactive for layout validation:

- visible links can be drag-reordered from inside the preview
- lead-form fields can be drag-reordered from inside the preview

This turns the preview into both a validation surface and an editing surface.

### Save State And Publishing Feedback

The desktop preview column also shows a compact status row above the phone:

- published or draft state
- save-state pill
- last-saved timestamp

This is useful because the page is autosave-driven. The user sees system state without leaving the editing context.

## 9. Public Profile Surface

### Live Public Page

The live public profile route is implemented in `src/app/[handle]/page.tsx`.

It is server-rendered and does the following before render:

- resolves the active profile for the handle
- loads signed avatar, header, and logo assets
- fetches the published lead form
- loads vCard contact details
- sanitizes theme choice based on plan access

### Visual Structure

The live profile uses a two-state layout:

Mobile:

- stacked hero card
- actions
- link list
- lead form below

Desktop:

- split layout with profile content on the left
- lead form on the right

The left column typically contains:

- hero block with avatar, optional logo, display name, headline, and handle
- action row
- link section

The right column contains:

- lead form card, when a lead form exists

### Shared Public Preview Component

The authenticated preview route at `/u/[handle]/preview` uses `src/components/public/PublicProfilePreview.tsx`.

That component is the reusable client-side version of the public profile layout. It supports:

- `split` and `stacked` modes
- optional forced-mobile rendering
- theme override
- optional contact CTA visibility

It mirrors the live page structure closely so the dashboard preview stays aligned with the real public page.

## 10. Public Profile Styling System

`src/styles/theme/public-profile.css` is the dedicated style layer for live public pages and dashboard phone previews.

It controls:

- animated backdrop and load sequencing
- image loading transitions
- lite mode behavior for lower-complexity rendering
- per-theme hero, card, button, and link treatments
- CTA button behavior
- lead-form field contrast treatment

Important design traits of this surface:

- theme-specific background art rather than flat fills
- strong visual contrast between hero area and content cards
- soft glassy cards with generous blur and shadow
- elevated primary CTA
- clear distinction between link cards and form cards

The public profile surface is the most theme-driven area in the codebase.

## 11. Responsive Strategy

The frontend uses different responsive tactics depending on the surface instead of forcing one pattern everywhere.

### Marketing

- mostly stacked on mobile
- becomes centered multi-column layouts on larger screens
- keeps large typography and generous whitespace

### Auth

- single-column on smaller screens
- two-column form plus supporting content on large screens

### Dashboard

- sticky sidebar on desktop
- overlay bottom-sheet navigation on mobile
- dashboard CSS contains many breakpoint-specific touch-ups for very small devices

### Public Profile Editor

- preview remains a side column on desktop
- preview becomes its own section on mobile
- section navigation changes from navbar pills to a select input

### Public Profile

- mobile-first stacked layout
- switches to a two-column split when width allows

## 12. Practical Component Ownership Summary

If you need to change frontend layout behavior, these are the first files to inspect:

- global shell: `src/app/layout.tsx`
- route-aware top navigation: `src/components/site/navbar.tsx`
- marketing template pages: `src/components/site/marketing-page.tsx`
- landing page composition: `src/app/page.tsx`
- auth layout content: `src/app/(auth)/auth/page.tsx`
- dashboard shell: `src/app/dashboard/layout.tsx`
- dashboard inner frame: `src/components/dashboard/DashboardAppShell.tsx`
- dashboard nav rail: `src/components/dashboard/Sidebar.tsx`
- dashboard chrome styling: `src/styles/theme/dashboard.css`
- public profile editor: `src/components/dashboard/public-profile/PublicProfileEditorPage.tsx`
- reusable public profile preview: `src/components/public/PublicProfilePreview.tsx`
- live public profile route: `src/app/[handle]/page.tsx`
- public profile theme styling: `src/styles/theme/public-profile.css`
- theme tokens and variants: `src/styles/theme/base.css`, `src/styles/theme/variants.css`, `src/lib/themes.ts`

## 13. High-Level Design Intent

The current frontend layout is built around one idea: the product should feel like one brand system even though it spans very different use cases.

That shows up in four ways:

- marketing pages are expressive and brand-forward
- auth pages soften the transition into the product
- the dashboard feels like a premium workspace rather than a plain admin panel
- public profiles and dashboard previews stay visually aligned so editing and publishing feel connected

In practice, the codebase achieves that by sharing theme tokens globally while still giving each surface its own layout language and motion style.
