import type { NextConfig } from "next";

function originFromEnv(url?: string) {
  try {
    if (!url) return null;
    const u = new URL(url);
    return u.origin;
  } catch {
    return null;
  }
}

const supabaseOrigin = originFromEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) || "https://*.supabase.co";

const csp = (
  [
    `default-src 'self'` ,
    `script-src 'self' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    `connect-src 'self' ${supabaseOrigin}`,
    `font-src 'self' data:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ].join("; ")
);

const nextConfig: NextConfig = {
  async headers() {
    const locked = process.env.PREVIEW_LOCK === "1";
    const baseHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: csp },
    ];
    if (locked) {
      baseHeaders.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    }
    return [
      {
        source: "/(.*)",
        headers: baseHeaders,
      },
    ];
  },
};

export default nextConfig;
