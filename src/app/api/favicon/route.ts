import { NextResponse } from "next/server";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

async function fetchWithTimeout(url: string, timeoutMs = 3000) {
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
}

async function returnImage(res: Response, source: string) {
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
  if (!host) {
    return errorResponse(400, "Invalid host");
  }

  if (host === "linketconnect.com" || host.endsWith(".linketconnect.com")) {
    return NextResponse.redirect(new URL("/favicon.png", request.url));
  }

  // Provider-only lookups avoid server-side fetches to arbitrary user URLs.
  const providerUrls = [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
    `https://api.faviconkit.com/${encodeURIComponent(host)}/128`,
  ];

  for (const url of providerUrls) {
    try {
      const providerResponse = await fetchWithTimeout(url, 2500);
      if (providerResponse.ok) {
        const contentType = providerResponse.headers.get("Content-Type") ?? "";
        if (!contentType || contentType.startsWith("image/")) {
          return returnImage(providerResponse, "provider");
        }
      }
    } catch {
      // ignore
    }
  }

  return new NextResponse(null, {
    status: 404,
    headers: {
      "X-Favicon-Source": "fallback",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
