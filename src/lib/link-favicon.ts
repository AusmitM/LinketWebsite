type LinkFaviconOptions = {
  apiVersion?: string;
  darkTheme?: boolean;
};

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

export function getLinkFaviconSrc(
  url: string,
  { apiVersion, darkTheme = false }: LinkFaviconOptions = {}
) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (!host) return null;

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

    const params = new URLSearchParams({ u: parsed.toString() });
    if (apiVersion) params.set("v", apiVersion);
    return `/api/favicon?${params.toString()}`;
  } catch {
    return null;
  }
}
