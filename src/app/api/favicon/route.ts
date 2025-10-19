import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return NextResponse.json({ error: "Missing 'u' param" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const origin = `${target.protocol}//${target.hostname}`;
  const fetchIcon = async (iconUrl: string) => {
    const resp = await fetch(iconUrl, { redirect: "follow" });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const buf = await resp.arrayBuffer();
    const type = resp.headers.get("content-type") || inferType(iconUrl) || "image/x-icon";
    return new NextResponse(buf, {
      status: 200,
      headers: cacheHeaders(type),
    });
  };

  // 1) Try to parse HTML for explicit icon links
  try {
    const page = await fetch(target.toString(), { redirect: "follow" });
    const ctype = page.headers.get("content-type") || "";
    if (page.ok && ctype.includes("text/html")) {
      const html = await page.text();
      const icons = extractIconHrefs(html)
        .map((href) => toAbsoluteUrl(href, origin))
        .filter(Boolean) as string[];
      // Prefer larger PNG/SVG, then ICO
      const preferred = prioritizeIcons(icons);
      for (const icon of preferred) {
        try { return await fetchIcon(icon); } catch { /* try next */ }
      }
    }
  } catch { /* ignore */ }

  // 2) Try /favicon.ico at site root
  try { return await fetchIcon(`${origin}/favicon.ico`); } catch { /* ignore */ }

  // 3) Fallback to Google S2 favicon service
  try { return await fetchIcon(`https://www.google.com/s2/favicons?domain=${target.hostname}&sz=64`); } catch { /* ignore */ }

  // 4) Nothing worked
  return NextResponse.json({ error: "Icon not found" }, { status: 404, headers: cacheHeaders("application/json") });
}

function extractIconHrefs(html: string): string[] {
  const out: string[] = [];
  const linkRe = /<link\b[^>]*>/gi;
  const relRe = /rel\s*=\s*"([^"]+)"|rel\s*=\s*'([^']+)'|rel\s*=\s*([^\s>]+)/i;
  const hrefRe = /href\s*=\s*"([^"]+)"|href\s*=\s*'([^']+)'|href\s*=\s*([^\s>]+)/i;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    const relMatch = tag.match(relRe);
    if (!relMatch) continue;
    const rel = (relMatch[1] || relMatch[2] || relMatch[3] || "").toLowerCase();
    if (!rel.includes("icon")) continue;
    const hrefMatch = tag.match(hrefRe);
    if (!hrefMatch) continue;
    const href = (hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || "").trim();
    if (href) out.push(href);
  }
  return out;
}

function toAbsoluteUrl(href: string, origin: string): string | null {
  try { return new URL(href, origin).toString(); } catch { return null; }
}

function prioritizeIcons(list: string[]): string[] {
  // Score: prefer png/svg with larger size cues in filename/path
  return [...list].sort((a, b) => scoreIcon(b) - scoreIcon(a));
}

function scoreIcon(u: string): number {
  let score = 0;
  const lu = u.toLowerCase();
  if (lu.endsWith(".svg") || lu.includes("image/svg")) score += 8; // prefer vector (transparent)
  if (lu.endsWith(".png")) score += 6; // often transparent
  if (lu.endsWith(".ico")) score += 3;
  if (/mask-icon/.test(lu)) score += 4;
  // De-prioritize Apple touch icons (often have opaque rounded square background)
  if (/apple-touch-icon/.test(lu)) score -= 5;
  const sizes = lu.match(/([0-9]{2,4})x\1/);
  if (sizes) score += parseInt(sizes[1], 10) / 16;
  return score;
}

function inferType(url: string): string | null {
  const lu = url.toLowerCase();
  if (lu.endsWith(".png")) return "image/png";
  if (lu.endsWith(".svg") || lu.includes("image/svg")) return "image/svg+xml";
  if (lu.endsWith(".jpg") || lu.endsWith(".jpeg")) return "image/jpeg";
  if (lu.endsWith(".ico")) return "image/x-icon";
  return null;
}

function cacheHeaders(contentType: string) {
  return {
    "Content-Type": contentType,
    // Client cache 1 day, edge (CDN) 7 days; allow stale-while-revalidate
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
  } as Record<string, string>;
}
