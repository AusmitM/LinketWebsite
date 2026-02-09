import { NextResponse } from "next/server";

const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=",
  "base64"
);

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("u");
  if (!raw) {
    return errorResponse(400, "Missing url");
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return errorResponse(400, "Invalid url");
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return errorResponse(400, "Unsupported protocol");
  }

  const host = target.hostname.toLowerCase();
  if (host === "linketconnect.com" || host === "www.linketconnect.com") {
    return NextResponse.redirect(new URL("/favicon.png", request.url));
  }

  const providerUrls = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(target.hostname)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(target.hostname)}.ico`,
    `https://api.faviconkit.com/${encodeURIComponent(target.hostname)}/128`,
  ];

  const fetchWithTimeout = async (url: string, timeoutMs = 3500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Linket-Favicon/1.0",
          Accept: "image/avif,image/webp,image/png,image/*;q=0.8,*/*;q=0.5",
        },
        redirect: "follow",
        cache: "force-cache",
        next: { revalidate: 86400 },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  const returnImage = async (res: Response, source: string) => {
    const contentType = res.headers.get("Content-Type") ?? "image/png";
    const body = Buffer.from(await res.arrayBuffer());
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Favicon-Source": source,
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  };

  const fetchIconUrl = async (url: URL, source: string) => {
    const res = await fetchWithTimeout(url.toString());
    if (!res.ok) return null;
    const contentType = res.headers.get("Content-Type") ?? "";
    if (contentType && !contentType.startsWith("image/")) return null;
    return returnImage(res, source);
  };

  const parseIconCandidates = (html: string) => {
    const candidates: Array<{ href: string; score: number }> = [];
    const linkRegex = /<link\s+[^>]*>/gi;
    const relRegex = /rel=["']?([^"'>]+)["']?/i;
    const hrefRegex = /href=["']?([^"'>\s]+)["']?/i;
    const sizesRegex = /sizes=["']?([^"'>]+)["']?/i;
    const matches = html.match(linkRegex) ?? [];

    for (const tag of matches) {
      const relMatch = tag.match(relRegex);
      const hrefMatch = tag.match(hrefRegex);
      if (!relMatch || !hrefMatch) continue;
      const rel = relMatch[1].toLowerCase();
      if (!rel.includes("icon")) continue;
      const href = hrefMatch[1];
      if (href.startsWith("data:")) continue;

      let score = 0;
      if (rel.includes("apple-touch-icon")) score += 3000;
      if (rel.includes("mask-icon")) score -= 100;

      const sizesMatch = tag.match(sizesRegex);
      if (sizesMatch) {
        const sizes = sizesMatch[1].toLowerCase();
        if (sizes === "any") {
          score += 4096;
        } else {
          const parsed = sizes
            .split(/\s+/)
            .map((size) => size.split("x").map(Number))
            .filter((pair) => pair.length === 2 && pair.every(Number.isFinite))
            .map(([w, h]) => w * h);
          if (parsed.length) score += Math.max(...parsed);
        }
      }

      candidates.push({ href, score });
    }

    return candidates.sort((a, b) => b.score - a.score);
  };

  try {
    const htmlResponse = await fetchWithTimeout(target.toString(), 3000);
    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      const candidates = parseIconCandidates(html);
      for (const candidate of candidates) {
        try {
          const iconUrl = new URL(candidate.href, target);
          if (iconUrl.hostname !== target.hostname) continue;
          const iconResponse = await fetchIconUrl(iconUrl, "html");
          if (iconResponse) return iconResponse;
        } catch {
          // ignore invalid icon urls
        }
      }
    }
  } catch {
    // ignore html fetch errors
  }

  const commonPaths = [
    "/apple-touch-icon.png",
    "/apple-touch-icon-precomposed.png",
    "/favicon-32x32.png",
    "/favicon-16x16.png",
    "/favicon.ico",
  ];
  for (const path of commonPaths) {
    try {
      const iconUrl = new URL(path, target);
      const iconResponse = await fetchIconUrl(iconUrl, "common-path");
      if (iconResponse) return iconResponse;
    } catch {
      // ignore
    }
  }

  for (const url of providerUrls) {
    try {
      const providerResponse = await fetchWithTimeout(url, 2500);
      if (providerResponse.ok) {
        return returnImage(providerResponse, "provider");
      }
    } catch {
      // ignore
    }
  }

  return new NextResponse(FALLBACK_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "X-Favicon-Source": "fallback",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
