# Button Contrast Report

## Summary

This audit validates semantic button tokens across every declared theme for text/icon contrast, component boundary contrast, link-style button text contrast, and focus-ring visibility. It covers 13 theme scopes and 1092 total checks across page and card surfaces.

AA status: all audited theme button states pass.

## Theme Summary

| theme | total checks | failing checks | failing components |
| --- | ---: | ---: | --- |
| :root (default) | 84 | 0 | None |
| .dark | 84 | 0 | None |
| .theme-light | 84 | 0 | None |
| .theme-dark | 84 | 0 | None |
| .theme-midnight | 84 | 0 | None |
| .theme-dream | 84 | 0 | None |
| .theme-forest | 84 | 0 | None |
| .theme-gilded | 84 | 0 | None |
| .theme-rose | 84 | 0 | None |
| .theme-autumn | 84 | 0 | None |
| .theme-honey | 84 | 0 | None |
| .theme-burnt-orange | 84 | 0 | None |
| .theme-maroon | 84 | 0 | None |

## Failures

| theme | component | check | state | surface | ratio | threshold | recommendation |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| None | None | None | None | None | None | None | All button checks pass. |

## Re-run

```bash
node scripts/check-button-contrast.mjs
```

