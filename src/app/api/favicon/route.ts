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
    return NextResponse.redirect(new URL("/linket-favicon.svg", request.url));
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    target.hostname
  )}&sz=64`;

  try {
    const res = await fetch(faviconUrl, {
      cache: "force-cache",
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return new NextResponse(FALLBACK_PNG, {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control":
            "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        },
      });
    }

    const contentType = res.headers.get("Content-Type") ?? "image/png";
    const body = Buffer.from(await res.arrayBuffer());

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse(FALLBACK_PNG, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  }
}
