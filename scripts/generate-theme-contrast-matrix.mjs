import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputFiles = [
  path.join(root, "src", "styles", "theme", "base.css"),
  path.join(root, "src", "styles", "theme", "variants.css"),
];
const outputJsonPath = path.join(
  root,
  "docs",
  "accessibility",
  "theme-contrast-matrix.json"
);
const outputMarkdownPath = path.join(
  root,
  "docs",
  "accessibility",
  "theme-contrast-matrix.md"
);

const pairings = [
  {
    id: "foreground/background",
    fgToken: "--foreground",
    bgToken: "--background",
    bgLayers: [],
    note: "Default page text on page background.",
  },
  {
    id: "card-foreground/card",
    fgToken: "--card-foreground",
    bgToken: "--card",
    bgLayers: ["--background"],
    note: "Card text on card surface.",
  },
  {
    id: "popover-foreground/popover",
    fgToken: "--popover-foreground",
    bgToken: "--popover",
    bgLayers: ["--background"],
    note: "Popover text on popover surface.",
  },
  {
    id: "primary-foreground/primary",
    fgToken: "--primary-foreground",
    bgToken: "--primary",
    bgLayers: ["--background"],
    note: "Primary button text on primary surface.",
  },
  {
    id: "secondary-foreground/secondary",
    fgToken: "--secondary-foreground",
    bgToken: "--secondary",
    bgLayers: ["--background"],
    note: "Secondary text on secondary surface.",
  },
  {
    id: "accent-foreground/accent",
    fgToken: "--accent-foreground",
    bgToken: "--accent",
    bgLayers: ["--background"],
    note: "Accent text on accent surface.",
  },
  {
    id: "muted-foreground/muted",
    fgToken: "--muted-foreground",
    bgToken: "--muted",
    bgLayers: ["--background"],
    note: "Muted text on muted surface.",
  },
  {
    id: "sidebar-foreground/sidebar",
    fgToken: "--sidebar-foreground",
    bgToken: "--sidebar",
    bgLayers: ["--background"],
    note: "Sidebar body text on sidebar surface.",
  },
  {
    id: "sidebar-primary-foreground/sidebar-primary",
    fgToken: "--sidebar-primary-foreground",
    bgToken: "--sidebar-primary",
    bgLayers: ["--sidebar", "--background"],
    note: "Sidebar primary action text on sidebar primary surface.",
  },
  {
    id: "sidebar-accent-foreground/sidebar-accent",
    fgToken: "--sidebar-accent-foreground",
    bgToken: "--sidebar-accent",
    bgLayers: ["--sidebar", "--background"],
    note: "Sidebar accent text on sidebar accent surface.",
  },
  {
    id: "muted-foreground/background",
    fgToken: "--muted-foreground",
    bgToken: "--background",
    bgLayers: [],
    note: "Muted text directly on page background.",
  },
  {
    id: "muted-foreground/card",
    fgToken: "--muted-foreground",
    bgToken: "--card",
    bgLayers: ["--background"],
    note: "Muted text directly on card surface.",
  },
  {
    id: "foreground/card",
    fgToken: "--foreground",
    bgToken: "--card",
    bgLayers: ["--background"],
    note: "Generic page text token reused on card surface.",
  },
];

const namedColors = {
  black: "#000000",
  white: "#ffffff",
  transparent: "#00000000",
};

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractTopLevelRules(css) {
  const rules = [];
  let index = 0;

  while (index < css.length) {
    while (index < css.length && /\s/.test(css[index])) {
      index += 1;
    }
    if (index >= css.length) break;

    if (css[index] === "@") {
      const nextBrace = css.indexOf("{", index);
      const nextSemi = css.indexOf(";", index);
      if (nextSemi !== -1 && (nextBrace === -1 || nextSemi < nextBrace)) {
        index = nextSemi + 1;
        continue;
      }
      if (nextBrace === -1) break;
      let depth = 1;
      index = nextBrace + 1;
      while (index < css.length && depth > 0) {
        if (css[index] === "{") depth += 1;
        if (css[index] === "}") depth -= 1;
        index += 1;
      }
      continue;
    }

    const selectorStart = index;
    const braceIndex = css.indexOf("{", selectorStart);
    if (braceIndex === -1) break;
    const selector = css.slice(selectorStart, braceIndex).trim();
    let depth = 1;
    index = braceIndex + 1;
    while (index < css.length && depth > 0) {
      if (css[index] === "{") depth += 1;
      if (css[index] === "}") depth -= 1;
      index += 1;
    }
    const body = css.slice(braceIndex + 1, index - 1).trim();
    rules.push({ selector, body });
  }

  return rules;
}

function parseDeclarations(body) {
  const declarations = {};
  const declarationPattern = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match = declarationPattern.exec(body);
  while (match) {
    declarations[match[1]] = match[2].trim();
    match = declarationPattern.exec(body);
  }
  return declarations;
}

function collectThemes() {
  const themes = [];

  for (const filePath of inputFiles) {
    const css = stripComments(fs.readFileSync(filePath, "utf8"));
    const rules = extractTopLevelRules(css);
    for (const rule of rules) {
      const selectors = rule.selector
        .split(",")
        .map((selector) => selector.trim())
        .filter(Boolean);
      for (const selector of selectors) {
        if (!/^(:root|\.dark|\.theme-[\w-]+)$/.test(selector)) continue;
        const declarations = parseDeclarations(rule.body);
        if (!("--background" in declarations) || !("--foreground" in declarations)) {
          continue;
        }
        themes.push({
          selector,
          label: selector === ":root" ? ":root (default)" : selector,
          sourceFile: path.relative(root, filePath).replace(/\\/g, "/"),
          declarations,
        });
      }
    }
  }

  return themes;
}

function normalizeNumber(value) {
  if (value.endsWith("%")) {
    return Number.parseFloat(value) / 100;
  }
  return Number.parseFloat(value);
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function parseHexColor(value) {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length)) {
    throw new Error(`Unsupported hex color: ${value}`);
  }

  if (hex.length === 3 || hex.length === 4) {
    const r = Number.parseInt(hex[0] + hex[0], 16) / 255;
    const g = Number.parseInt(hex[1] + hex[1], 16) / 255;
    const b = Number.parseInt(hex[2] + hex[2], 16) / 255;
    const a =
      hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) / 255 : 1;
    return { r, g, b, a };
  }

  const r = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const g = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const b = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function parseRgbColor(value) {
  const match = value.match(/^rgba?\((.+)\)$/i);
  if (!match) {
    throw new Error(`Unsupported rgb color: ${value}`);
  }

  const rawParts = match[1].includes("/")
    ? match[1]
        .replace(/\s*\/\s*/, ",")
        .split(",")
        .map((part) => part.trim())
    : match[1].split(",").map((part) => part.trim());

  if (rawParts.length < 3) {
    throw new Error(`Invalid rgb color: ${value}`);
  }

  const [rPart, gPart, bPart, aPart] = rawParts;
  const r = clamp01(normalizeNumber(rPart) / (rPart.endsWith("%") ? 1 : 255));
  const g = clamp01(normalizeNumber(gPart) / (gPart.endsWith("%") ? 1 : 255));
  const b = clamp01(normalizeNumber(bPart) / (bPart.endsWith("%") ? 1 : 255));
  const a = aPart ? clamp01(normalizeNumber(aPart)) : 1;
  return { r, g, b, a };
}

function formatHex(color) {
  const toHex = (component) =>
    Math.round(clamp01(component) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function formatRgba(color) {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  const alpha = Number(color.a.toFixed(4));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function composite(source, backdrop) {
  const as = clamp01(source.a);
  const ab = clamp01(backdrop.a);
  const ao = as + ab * (1 - as);
  if (ao === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  return {
    r: (as * source.r + ab * backdrop.r * (1 - as)) / ao,
    g: (as * source.g + ab * backdrop.g * (1 - as)) / ao,
    b: (as * source.b + ab * backdrop.b * (1 - as)) / ao,
    a: ao,
  };
}

function srgbToLinear(channel) {
  if (channel <= 0.04045) {
    return channel / 12.92;
  }
  return ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  return (
    0.2126 * srgbToLinear(color.r) +
    0.7152 * srgbToLinear(color.g) +
    0.0722 * srgbToLinear(color.b)
  );
}

function contrastRatio(foreground, background) {
  const luminanceForeground = relativeLuminance(foreground);
  const luminanceBackground = relativeLuminance(background);
  const lighter = Math.max(luminanceForeground, luminanceBackground);
  const darker = Math.min(luminanceForeground, luminanceBackground);
  return {
    ratio: (lighter + 0.05) / (darker + 0.05),
    luminanceForeground,
    luminanceBackground,
  };
}

function resolveValue(theme, token, stack = new Set()) {
  if (stack.has(token)) {
    throw new Error(`Circular token reference detected for ${token}`);
  }
  stack.add(token);
  const rawValue = theme.declarations[token];
  if (!rawValue) {
    return null;
  }

  const directVarMatch = rawValue.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/);
  if (directVarMatch) {
    const nextValue = resolveValue(theme, directVarMatch[1], stack);
    if (nextValue) {
      stack.delete(token);
      return nextValue;
    }
    stack.delete(token);
    return directVarMatch[2] ? directVarMatch[2].trim() : null;
  }

  stack.delete(token);
  return rawValue.trim();
}

function parseColor(theme, token) {
  const value = resolveValue(theme, token);
  if (!value) {
    throw new Error(`Missing value for ${token} in ${theme.selector}`);
  }

  const normalized = namedColors[value.toLowerCase()] ?? value;
  let color;

  if (normalized.startsWith("#")) {
    color = parseHexColor(normalized);
  } else if (/^rgba?\(/i.test(normalized)) {
    color = parseRgbColor(normalized);
  } else {
    throw new Error(
      `Unsupported color format for ${token} in ${theme.selector}: ${value}`
    );
  }

  return {
    token,
    raw: value,
    color,
    hex: formatHex(color),
    rgba: formatRgba(color),
  };
}

function buildTheme(theme, rootTheme) {
  return {
    selector: theme.selector,
    label: theme.label,
    sourceFile: theme.sourceFile,
    declarations: { ...rootTheme.declarations, ...theme.declarations },
  };
}

function compositeSurface(theme, bgToken, bgLayers) {
  const fallback = { r: 1, g: 1, b: 1, a: 1 };
  const layerTokens = [bgToken, ...bgLayers];
  const parsedLayers = layerTokens.map((token) => parseColor(theme, token));
  let effective = fallback;
  for (let index = parsedLayers.length - 1; index >= 0; index -= 1) {
    effective = composite(parsedLayers[index].color, effective);
  }
  return {
    effective,
    layers: parsedLayers.map((layer) => ({
      token: layer.token,
      raw: layer.raw,
      hex: layer.hex,
      rgba: layer.rgba,
      alpha: Number(layer.color.a.toFixed(4)),
    })),
  };
}

function classifyPair(result) {
  if (!result.aaPass) return "AA fail";
  if (!result.aaaPass) return "AA only";
  return "AAA pass";
}

function recommendationFor(result) {
  if (!result.aaPass) {
    if (result.pairing.id === "foreground/card") {
      return "Prefer var(--card-foreground) for card descendants instead of reusing the page foreground token.";
    }
    if (
      result.theme.selector === ".theme-burnt-orange" ||
      result.theme.selector === ".theme-maroon"
    ) {
      return "Split page-surface text tokens from card-surface text tokens; the brand background is too close to the shared page foreground.";
    }
    return `Adjust ${result.pairing.fgToken} or ${result.pairing.bgToken} to reach at least 4.5:1 for normal text.`;
  }

  if (!result.aaaPass) {
    return "AA passes. Raise contrast further if AAA is a project goal.";
  }

  return "No text contrast change required for this pairing.";
}

function run() {
  const rawThemes = collectThemes();
  const rootTheme = rawThemes.find((theme) => theme.selector === ":root");
  if (!rootTheme) {
    throw new Error("Unable to locate :root theme tokens.");
  }

  const auditedThemes = rawThemes.map((theme) => buildTheme(theme, rootTheme));
  const results = [];

  for (const theme of auditedThemes) {
    for (const pairing of pairings) {
      const foreground = parseColor(theme, pairing.fgToken);
      const backgroundSurface = compositeSurface(theme, pairing.bgToken, pairing.bgLayers);
      const effectiveForeground = composite(
        foreground.color,
        backgroundSurface.effective
      );
      const contrast = contrastRatio(effectiveForeground, backgroundSurface.effective);

      results.push({
        theme,
        pairing,
        fg: {
          token: pairing.fgToken,
          raw: foreground.raw,
          hex: formatHex(effectiveForeground),
          rgba: formatRgba(effectiveForeground),
          alpha: Number(foreground.color.a.toFixed(4)),
        },
        bg: {
          token: pairing.bgToken,
          hex: formatHex(backgroundSurface.effective),
          rgba: formatRgba(backgroundSurface.effective),
          alpha: Number(backgroundSurface.effective.a.toFixed(4)),
          layers: backgroundSurface.layers,
        },
        contrastRatio: contrast.ratio,
        luminanceForeground: contrast.luminanceForeground,
        luminanceBackground: contrast.luminanceBackground,
        aaPass: contrast.ratio >= 4.5,
        aaaPass: contrast.ratio >= 7,
      });
    }
  }

  const themesSummary = auditedThemes.map((theme) => {
    const themeResults = results.filter((result) => result.theme.selector === theme.selector);
    const aaFailures = themeResults.filter((result) => !result.aaPass);
    const aaaOnly = themeResults.filter((result) => result.aaPass && !result.aaaPass);
    const nearThreshold = themeResults.filter(
      (result) => result.aaPass && result.contrastRatio < 4.8
    );

    return {
      selector: theme.selector,
      label: theme.label,
      source_file: theme.sourceFile,
      audited_pairs: themeResults.length,
      aa_fail_count: aaFailures.length,
      aaa_only_count: aaaOnly.length,
      near_threshold_count: nearThreshold.length,
      aa_fail_pairs: aaFailures.map((result) => result.pairing.id),
      aaa_only_pairs: aaaOnly.map((result) => result.pairing.id),
      status: aaFailures.length > 0 ? "aa-failures" : "aa-pass",
    };
  });

  const aaFailThemes = themesSummary
    .filter((theme) => theme.aa_fail_count > 0)
    .map((theme) => theme.label);
  const nearThresholdPairs = results
    .filter((result) => result.aaPass && result.contrastRatio < 4.8)
    .map((result) => ({
      theme: result.theme.label,
      pair: result.pairing.id,
      contrast_ratio: Number(result.contrastRatio.toFixed(2)),
    }));

  const jsonReport = {
    meta: {
      wcag_version_targets: ["WCAG 2.1", "WCAG 2.2"],
      conformance_levels: ["AA baseline", "AAA deltas"],
      audit_timestamp: new Date().toISOString(),
      tool_assumptions: [
        "All audited theme selectors were read from src/styles/theme/base.css and src/styles/theme/variants.css.",
        "Contrast ratio uses WCAG relative luminance and source-over alpha compositing before luminance is computed.",
        "Theme-pair checks assume normal text thresholds unless a component explicitly renders large text.",
        "Non-solid backgrounds, images, gradients, and shadows are outside this token-matrix sweep and remain manual-review items.",
      ],
      theme_sources: inputFiles.map((filePath) =>
        path.relative(root, filePath).replace(/\\/g, "/")
      ),
      pairings_audited: pairings.map((pairing) => ({
        id: pairing.id,
        fg_token: pairing.fgToken,
        bg_token: pairing.bgToken,
        bg_layers: pairing.bgLayers,
        note: pairing.note,
      })),
    },
    themes: themesSummary,
    pairings: results.map((result) => ({
      theme: result.theme.label,
      theme_selector: result.theme.selector,
      source_file: result.theme.sourceFile,
      pair: result.pairing.id,
      role: "text",
      fg: result.fg,
      bg: result.bg,
      computed: {
        contrast_ratio: Number(result.contrastRatio.toFixed(2)),
        luminance_fg: Number(result.luminanceForeground.toFixed(4)),
        luminance_bg: Number(result.luminanceBackground.toFixed(4)),
        method: "computed",
      },
      wcag: {
        sc: ["1.4.3", "1.4.6"],
        aa_pass: result.aaPass,
        aaa_pass: result.aaaPass,
        status: classifyPair(result),
      },
      notes: [result.pairing.note, recommendationFor(result)],
    })),
    summary: {
      theme_count: auditedThemes.length,
      audited_pairings_per_theme: pairings.length,
      total_pair_results: results.length,
      aa_pass_themes: themesSummary
        .filter((theme) => theme.aa_fail_count === 0)
        .map((theme) => theme.label),
      aa_fail_themes: aaFailThemes,
      contextual_risks: results
        .filter(
          (result) =>
            !result.aaPass && result.pairing.id === "foreground/card"
        )
        .map((result) => ({
          theme: result.theme.label,
          pair: result.pairing.id,
          contrast_ratio: Number(result.contrastRatio.toFixed(2)),
        })),
      near_threshold_pairs: nearThresholdPairs,
    },
  };

  const summaryLines = themesSummary.map((theme) => {
    const aaFailures = theme.aa_fail_pairs.length
      ? theme.aa_fail_pairs.join(", ")
      : "None";
    const aaaOnly = theme.aaa_only_pairs.length
      ? theme.aaa_only_pairs.join(", ")
      : "None";
    return `| ${theme.label} | ${theme.source_file} | ${theme.audited_pairs} | ${theme.aa_fail_count} | ${theme.aaa_only_count} | ${aaFailures} | ${aaaOnly} |`;
  });

  const failingRows = results
    .filter((result) => !result.aaPass)
    .map(
      (result) =>
        `| ${result.theme.label} | ${result.pairing.id} | ${result.fg.hex} | ${result.bg.hex} | ${result.contrastRatio.toFixed(2)}:1 | Fail AA 1.4.3 | ${recommendationFor(result)} |`
    );

  const aaaRows = results
    .filter((result) => result.aaPass && !result.aaaPass)
    .sort((left, right) => left.contrastRatio - right.contrastRatio)
    .slice(0, 24)
    .map(
      (result) =>
        `| ${result.theme.label} | ${result.pairing.id} | ${result.contrastRatio.toFixed(2)}:1 | Pass AA, fail AAA |`
    );

  const markdown = `# Theme Contrast Matrix

## Executive Summary

This matrix audits every declared theme scope in \`src/styles/theme/base.css\` and \`src/styles/theme/variants.css\` against the standard text-to-surface pairings used by the design tokens. The sweep covers ${auditedThemes.length} theme scopes and ${pairings.length} pairings per scope, with WCAG source-over alpha compositing applied before relative luminance and contrast calculations.

AA status: ${aaFailThemes.length === 0 ? "all audited themes pass" : `${auditedThemes.length - aaFailThemes.length} themes pass and ${aaFailThemes.length} theme scopes still have AA failures`}. Open AA failures remain in ${aaFailThemes.join(", ")}. A contextual AA risk also remains where \`--foreground\` is reused on \`--card\` in \`.theme-forest\`.

## Coverage

- Theme sources: \`${jsonReport.meta.theme_sources.join("`, `")}\`
- Pairings audited: \`${pairings.map((pairing) => pairing.id).join("`, `")}\`
- Thresholds: AA \`>= 4.5:1\` for normal text, AAA \`>= 7:1\`
- Out of scope for this matrix: gradients, images, charts, borders, non-text contrast, and focus indicators. Those stay in the main audit report.

## Theme Summary

| theme | source file | pairings audited | AA fails | AAA-only deltas | failing pairs | AAA-only pairs |
| --- | --- | ---: | ---: | ---: | --- | --- |
${summaryLines.join("\n")}

## AA Failures And Contextual Risks

| theme | pair | fg | bg | ratio | status | recommendation |
| --- | --- | --- | --- | ---: | --- | --- |
${failingRows.length > 0 ? failingRows.join("\n") : "| None | None | None | None | None | All pass | No AA failures detected |"}

## Lowest AAA Deltas

| theme | pair | ratio | status |
| --- | --- | ---: | --- |
${aaaRows.length > 0 ? aaaRows.join("\n") : "| None | None | None | None |"}

## Method

- Token values were resolved from theme declarations with \`:root\` fallbacks.
- Alpha colors were composited with source-over math before luminance and contrast calculations.
- Surface tokens with translucency, such as popovers, were composited against their parent surface stack.
- This matrix treats token pairings as normal text by default. Large-text exceptions still need component-level verification where applicable.

## Re-run

\`\`\`bash
node scripts/generate-theme-contrast-matrix.mjs
\`\`\`
`;

  fs.writeFileSync(outputJsonPath, `${JSON.stringify(jsonReport, null, 2)}\n`);
  fs.writeFileSync(outputMarkdownPath, `${markdown}\n`);

  console.log(
    `Generated ${path.relative(root, outputMarkdownPath)} and ${path.relative(
      root,
      outputJsonPath
    )}.`
  );
}

try {
  run();
} catch (error) {
  console.error(
    `[theme-contrast] ${error instanceof Error ? error.message : "Unknown error"}`
  );
  process.exitCode = 1;
}
