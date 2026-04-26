type LinkFaviconOptions = {
  apiVersion?: string;
  darkTheme?: boolean;
};

function pushUnique(candidates: string[], value: string | null) {
  if (!value || candidates.includes(value)) return;
  candidates.push(value);
}

function isZelleHost(host: string) {
  return (
    host === "zelle.com" ||
    host.endsWith(".zelle.com") ||
    host === "zellepay.com" ||
    host.endsWith(".zellepay.com") ||
    host === "zelle.me" ||
    host.endsWith(".zelle.me")
  );
}

function getStaticLinkFaviconSrc(
  host: string,
  { darkTheme = false }: Pick<LinkFaviconOptions, "darkTheme"> = {}
) {
  if (
    host === "instagr.am" ||
    host.endsWith(".instagram.com") ||
    host === "instagram.com"
  ) {
    return "/icons/instagram-logo.png";
  }
  if (host.endsWith(".github.com") || host === "github.com") {
    return darkTheme ? "/icons/github-logo-dark.png" : "/icons/github-logo.png";
  }
  if (host.endsWith(".tiktok.com") || host === "tiktok.com") {
    return darkTheme ? "/icons/tiktok-logo-dark.png" : "/icons/tiktok-logo.png";
  }
  if (isZelleHost(host)) {
    return darkTheme ? "/icons/zelle-logo-dark.svg" : "/icons/zelle-logo.svg";
  }
  if (host.endsWith(".youtube.com") || host === "youtube.com") {
    return "/icons/yt-logo.png";
  }
  return null;
}

export function getLinkFaviconCandidates(
  url: string,
  { apiVersion, darkTheme = false }: LinkFaviconOptions = {}
) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host) return [];

    const staticSrc = getStaticLinkFaviconSrc(host, { darkTheme });
    if (staticSrc) return [staticSrc];

    const candidates: string[] = [];
    const params = new URLSearchParams({ u: parsed.toString() });
    if (apiVersion) params.set("v", apiVersion);
    pushUnique(candidates, `/api/favicon?${params.toString()}`);

    pushUnique(
      candidates,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    );
    pushUnique(
      candidates,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`
    );
    pushUnique(
      candidates,
      `https://api.faviconkit.com/${encodeURIComponent(host)}/128`
    );

    const secureOrigin =
      parsed.protocol === "https:" ? parsed.origin : `https://${parsed.host}`;
    pushUnique(candidates, `${secureOrigin}/favicon.ico`);
    pushUnique(candidates, `${secureOrigin}/apple-touch-icon.png`);

    return candidates;
  } catch {
    return [];
  }
}

export function getLinkFaviconSrc(
  url: string,
  options: LinkFaviconOptions = {}
) {
  return getLinkFaviconCandidates(url, options)[0] ?? null;
}
