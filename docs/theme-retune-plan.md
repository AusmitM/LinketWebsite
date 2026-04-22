# Theme Retune Plan

## Current State

- The live token matrix currently passes AA for the audited text pairs in `src/styles/theme/base.css` and `src/styles/theme/variants.css`.
- The biggest remaining issues are weak non-text boundary contrast, warm-theme overlap, and documentation drift between source tokens and the markdown references.
- Theme identity is split across `variants.css`, `dashboard.css`, and `public-profile.css`, so small palette changes require too many follow-on overrides.

## Priority 1: Boundary Contrast

- Introduce stronger semantic boundary tokens instead of asking `--border` and `--input` to serve every surface.
- Start in `src/styles/theme/base.css` with a small split such as `--border-strong` and `--input-strong`, or equivalent component-scoped aliases.
- Retune light/default, `dream`, and `honey` first. Those palettes rely the most on glow and shadow to separate adjacent surfaces.
- Target at least 3:1 for visible boundaries against the adjacent canvas before any shadow is applied.

## Priority 2: Warm-Family Separation

- Retune in OKLCH so the warm themes separate by lightness and chroma character, not just hue label.
- `rose`: keep it blush/coral and airy. Reduce amber spill so it does not read like a softer `autumn`.
- `autumn`: push it deeper and spicier. It should own the amber/copper middle range instead of sharing it with `honey`.
- `honey`: bias more yellow-ochre and less orange-red. It should feel golden, not like a brighter `autumn`.
- `burnt-orange`: keep the collegiate copper identity, but deepen the surrounding neutrals so the brand orange feels deliberate rather than interchangeable with the other warm themes.
- `maroon`: move cooler and deeper toward oxblood/wine. Its neutrals should feel rosier and less cream-orange than `burnt-orange`.

## Priority 3: Token Architecture

- Keep `variants.css` as the source of truth for semantic palette tokens.
- Reduce one-off theme chrome in `dashboard.css` and `public-profile.css` where a shared semantic token would do the job.
- Prefer deriving `--premium-*`, focus, and button states from a smaller semantic set instead of hand-tuning each theme in multiple files.
- Keep page-surface, card-surface, and hero-surface concerns distinct when a theme needs different foreground behavior on each.

## Priority 4: Workflow

- Regenerate `docs/accessibility/theme-contrast-matrix.md` and `.json` after any token retune.
- Keep `docs/theme-color-reference.md` synced to live theme tokens, or replace the hand-maintained table with generated output.
- Treat `docs/accessibility/color-contrast-audit.md` as a narrative summary and the generated matrix as the live numeric source of truth.
