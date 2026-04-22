# Linket Theme Color Reference

This reference documents the live theme palettes currently defined in:

- `src/styles/theme/base.css`
- `src/styles/theme/variants.css`
- `src/styles/theme/dashboard.css`
- `src/styles/theme/public-profile.css`

## Shared Token Legend

| Token | Where it is used |
| --- | --- |
| `--background` | App/page canvas, dashboard shell base, public profile shell background |
| `--foreground` | Primary text, default icons, high-contrast copy |
| `--card` | Cards, popovers, preview panels, analytics tiles, form containers |
| `--primary` | Main CTA fills, selected states, strong highlights, progress accents |
| `--secondary` | Secondary buttons, support surfaces, softer nav/button fills |
| `--accent` | Decorative emphasis, highlight treatments, chips, glow support |
| `--border` | Card borders, input borders, dividers, separators, outlines |
| `--ring` | Focus rings, avatar borders, active glows, highlighted controls |
| `--sidebar` | Dashboard sidebar and navigation chrome base surface |
| `--button-subtle-foreground` | Text/icon color for secondary, outline, ghost, and link-style buttons |
| `--premium-*` | Dashboard top bar gradients, premium cards, navbar chrome, logo glow treatments |
| `public-profile` overrides | Public profile hero backgrounds, profile cards, CTA gradients, preview shell styling |

## Theme Palette Map

| Theme | Background | Foreground | Card / elevated surface | Primary / main CTA | Secondary / support surface | Accent / focus | Border / chrome | Where the theme stands out |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Light` | `#f5f7fb` | `#101828` | `#ffffff` | `#2563eb` | `#e0e7ff`, subtle actions `#23458f` | accent `#c7d2fe`, ring `#2563eb` | border `#d7deed`, sidebar `#ffffff` | Bright app canvas, airy blue dashboard chrome, pale blue public profile backdrop, crisp white cards |
| `Dark` | `#121826` | `#f6f8ff` | `rgba(26, 34, 55, 0.94)` | `#63a8ff` | `#253352`, subtle actions `#dce7ff` | accent `#31476f`, ring `#63a8ff` | border `#212f4a`, sidebar `#111a2b` | Cool twilight dashboard shell with electric blue focus/CTA states; public profile styling is driven by the shared semantic tokens rather than extra theme-specific overrides |
| `Midnight` | `#050414` | `#f7f5ff` | `rgba(18, 15, 46, 0.94)` | `#8d5fff` | `#231b50`, subtle actions `#ebe4ff` | accent `#352a6b`, ring `#8d5fff` | border `#261f56`, sidebar `#0c0923` | Deep violet night palette with neon-style purple focus states and premium dark dashboard surfaces |
| `Dream` | `#f4e9ff` | `#1d1f3d` | `rgba(255, 255, 255, 0.96)` | `#3a2ad6` | `#f2a3db`, subtle actions `#3f3dab` | accent `#b8a6ff`, ring `#3a2ad6` | border `#d8cbed`, sidebar `#efe1ff` | Pastel lavender dashboard chrome, soft violet public profile gradients, dreamy white-violet cards, blue-violet CTAs |
| `Forest` | `#1d2b20` | `#fbf4e8` | `rgba(54, 72, 60, 0.96)` | `#8f5135` | `#3e5244`, subtle actions `#fbf4e8` | accent `#ddb192`, ring `#ddb192` | border `#6e8973`, sidebar `#1d2b20` | Darker woodland shell with ember accents, tree-line pattern in public profiles, stronger moss-green boundaries, warm tan focus glows |
| `Gilded` | `#050505` | `#f4eee3` | `rgba(16, 16, 17, 0.94)` | `#e5b23a` | `#171718`, subtle actions `#e8dcc1` | accent `#ffd86f`, ring `#ffd86f` | border `#2d2617`, sidebar `#0d0d0e` | Matte black shell with a warmer orange-gold highlight, brighter CTA sheen, and a contour-lined public profile backdrop |
| `Rose` | `#ffe0d2` | `#4a1713` | `rgba(255, 236, 226, 0.96)` | `#df4d3a` | `#ffcaa0`, subtle actions `#7c2f22` | accent `#f5b16f`, ring `#9a3412` | border `#f0b9a2`, sidebar `#ffd8c4` | Rosy coral dashboard top bar, warm blush public profile cards, soft orange support surfaces, warm brown action text |
| `Autumn` | `#f3d9b2` | `#3c2012` | `rgba(255, 246, 231, 0.97)` | `#bd5230` | `#e5bf69`, subtle actions `#682c13` | accent `#d98f47`, ring `#9a3412` | border `#ddb686`, sidebar `#efd09d` | Amber-and-spice dashboard chrome, layered autumn public profile glows, warm cream cards, copper CTA emphasis |
| `Honey` | `#f7dcab` | `#3f1f0c` | `rgba(255, 242, 217, 0.95)` | `#df6206` | `#f4c25a`, subtle actions `#6d350d` | accent `#ebaa32`, ring `#9a3412` | border `#f4c25a`, sidebar `#fddb9c` | Honeycomb/hex pattern in public profiles, warm golden dashboard top bar, glowing logo pill, amber-orange CTAs and support surfaces |
| `Hook 'Em` (`burnt-orange`) | `#fff2e6` | `#4a2312` | `#fffaf6` | `#b55200` | `#f6deca`, subtle actions `#7a360d` | accent `#e88b3a`, ring `#8f3d00` | border `#e7c2a3`, sidebar `#fff8f2` | UT-inspired copper public profile hero, cream cards, burnt-orange CTA gradient, team-specific logo glow and preview chrome |
| `Aggie` (`maroon`) | `#fff0f2` | `#4c0b15` | `#fffafb` | `#500000` | `#f2dde2`, subtle actions `#681423` | accent `#7d1730`, ring `#6c1128` | border `#e4c0c8`, sidebar `#fff5f6` | Deep wine hero treatment, blush cards, maroon CTA gradient, team-specific logo glow and dramatic profile surfaces |

## Theme-Specific Surface Notes

- `Light`, `Dream`, `Rose`, `Autumn`, `Honey`, and `Gilded` define extra dashboard top-bar, nav, card, and logo treatments in `src/styles/theme/variants.css`.
- `Forest` adds a tree-line pattern to public profiles and preview shells, and it increases dashboard border emphasis for better contrast.
- `Dark` and `Midnight` rely mostly on the shared premium dashboard/public profile styling, so their look comes primarily from the semantic tokens above rather than separate per-theme override blocks.
- `Gilded` now adds dedicated matte-black dashboard chrome plus a layered black-and-gold contour backdrop for public profiles and previews.
- `Hook 'Em` and `Aggie` have the most custom public-profile styling: dedicated hero gradients, cream/blush card treatments, branded CTA gradients, and custom logo glow states.

## Derived State Colors

Button hover, active, outline, ghost, destructive, success, disabled, and focus colors are mostly derived with `color-mix(...)` from the tokens above. In practice that means:

- `primary`, `secondary`, `card`, `foreground`, `muted`, and `ring` are the source colors that generate most interactive states.
- The table above is the most reliable place to start when adjusting a theme, because changing those source tokens cascades through the dashboard and public profile styles automatically.
