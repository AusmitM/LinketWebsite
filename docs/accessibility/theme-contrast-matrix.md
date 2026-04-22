# Theme Contrast Matrix

## Executive Summary

This matrix audits every declared theme scope in `src/styles/theme/base.css` and `src/styles/theme/variants.css` against the standard text-to-surface pairings used by the design tokens. The sweep covers 13 theme scopes and 13 pairings per scope, with WCAG source-over alpha compositing applied before relative luminance and contrast calculations.

AA status: all audited themes pass. No audited theme scopes currently fail AA. No contextual AA risks were detected in the audited token pairs.

## Coverage

- Theme sources: `src/styles/theme/base.css`, `src/styles/theme/variants.css`
- Pairings audited: `foreground/background`, `card-foreground/card`, `popover-foreground/popover`, `primary-foreground/primary`, `secondary-foreground/secondary`, `accent-foreground/accent`, `muted-foreground/muted`, `sidebar-foreground/sidebar`, `sidebar-primary-foreground/sidebar-primary`, `sidebar-accent-foreground/sidebar-accent`, `muted-foreground/background`, `muted-foreground/card`, `foreground/card`
- Thresholds: AA `>= 4.5:1` for normal text, AAA `>= 7:1`
- Out of scope for this matrix: gradients, images, charts, borders, non-text contrast, and focus indicators. Those stay in the main audit report.

## Theme Summary

| theme | source file | pairings audited | AA fails | AAA-only deltas | failing pairs | AAA-only pairs |
| --- | --- | ---: | ---: | ---: | --- | --- |
| :root (default) | src/styles/theme/base.css | 13 | 0 | 2 | None | primary-foreground/primary, sidebar-primary-foreground/sidebar-primary |
| .dark | src/styles/theme/base.css | 13 | 0 | 0 | None | None |
| .theme-light | src/styles/theme/variants.css | 13 | 0 | 2 | None | primary-foreground/primary, sidebar-primary-foreground/sidebar-primary |
| .theme-dark | src/styles/theme/variants.css | 13 | 0 | 0 | None | None |
| .theme-midnight | src/styles/theme/variants.css | 13 | 0 | 2 | None | primary-foreground/primary, sidebar-primary-foreground/sidebar-primary |
| .theme-dream | src/styles/theme/variants.css | 13 | 0 | 3 | None | muted-foreground/muted, muted-foreground/background, muted-foreground/card |
| .theme-forest | src/styles/theme/variants.css | 13 | 0 | 3 | None | primary-foreground/primary, sidebar-primary-foreground/sidebar-primary, sidebar-accent-foreground/sidebar-accent |
| .theme-gilded | src/styles/theme/variants.css | 13 | 0 | 0 | None | None |
| .theme-rose | src/styles/theme/variants.css | 13 | 0 | 3 | None | primary-foreground/primary, muted-foreground/muted, sidebar-primary-foreground/sidebar-primary |
| .theme-autumn | src/styles/theme/variants.css | 13 | 0 | 4 | None | primary-foreground/primary, accent-foreground/accent, muted-foreground/muted, sidebar-primary-foreground/sidebar-primary |
| .theme-honey | src/styles/theme/variants.css | 13 | 0 | 4 | None | primary-foreground/primary, muted-foreground/muted, sidebar-primary-foreground/sidebar-primary, muted-foreground/background |
| .theme-burnt-orange | src/styles/theme/variants.css | 13 | 0 | 5 | None | primary-foreground/primary, accent-foreground/accent, muted-foreground/muted, sidebar-primary-foreground/sidebar-primary, muted-foreground/background |
| .theme-maroon | src/styles/theme/variants.css | 13 | 0 | 2 | None | muted-foreground/muted, muted-foreground/background |

## AA Failures And Contextual Risks

| theme | pair | fg | bg | ratio | status | recommendation |
| --- | --- | --- | --- | ---: | --- | --- |
| None | None | None | None | None | All pass | No AA failures detected |

## Lowest AAA Deltas

| theme | pair | ratio | status |
| --- | --- | ---: | --- |
| .theme-autumn | primary-foreground/primary | 4.53:1 | Pass AA, fail AAA |
| .theme-autumn | sidebar-primary-foreground/sidebar-primary | 4.53:1 | Pass AA, fail AAA |
| .theme-burnt-orange | primary-foreground/primary | 4.78:1 | Pass AA, fail AAA |
| .theme-burnt-orange | sidebar-primary-foreground/sidebar-primary | 4.78:1 | Pass AA, fail AAA |
| .theme-dream | muted-foreground/muted | 4.81:1 | Pass AA, fail AAA |
| :root (default) | primary-foreground/primary | 4.86:1 | Pass AA, fail AAA |
| :root (default) | sidebar-primary-foreground/sidebar-primary | 4.86:1 | Pass AA, fail AAA |
| .theme-light | primary-foreground/primary | 4.86:1 | Pass AA, fail AAA |
| .theme-light | sidebar-primary-foreground/sidebar-primary | 4.86:1 | Pass AA, fail AAA |
| .theme-honey | primary-foreground/primary | 4.88:1 | Pass AA, fail AAA |
| .theme-honey | sidebar-primary-foreground/sidebar-primary | 4.88:1 | Pass AA, fail AAA |
| .theme-midnight | primary-foreground/primary | 4.95:1 | Pass AA, fail AAA |
| .theme-midnight | sidebar-primary-foreground/sidebar-primary | 4.95:1 | Pass AA, fail AAA |
| .theme-rose | primary-foreground/primary | 5.00:1 | Pass AA, fail AAA |
| .theme-rose | sidebar-primary-foreground/sidebar-primary | 5.00:1 | Pass AA, fail AAA |
| .theme-dream | muted-foreground/background | 5.20:1 | Pass AA, fail AAA |
| .theme-burnt-orange | accent-foreground/accent | 5.31:1 | Pass AA, fail AAA |
| .theme-honey | muted-foreground/muted | 5.53:1 | Pass AA, fail AAA |
| .theme-forest | primary-foreground/primary | 5.71:1 | Pass AA, fail AAA |
| .theme-forest | sidebar-primary-foreground/sidebar-primary | 5.71:1 | Pass AA, fail AAA |
| .theme-burnt-orange | muted-foreground/muted | 5.84:1 | Pass AA, fail AAA |
| .theme-autumn | accent-foreground/accent | 5.93:1 | Pass AA, fail AAA |
| .theme-dream | muted-foreground/card | 6.05:1 | Pass AA, fail AAA |
| .theme-forest | sidebar-accent-foreground/sidebar-accent | 6.15:1 | Pass AA, fail AAA |

## Method

- Token values were resolved from theme declarations with `:root` fallbacks.
- Alpha colors were composited with source-over math before luminance and contrast calculations.
- Surface tokens with translucency, such as popovers, were composited against their parent surface stack.
- This matrix treats token pairings as normal text by default. Large-text exceptions still need component-level verification where applicable.

## Re-run

```bash
node scripts/generate-theme-contrast-matrix.mjs
```

