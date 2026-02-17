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

const supabaseOrigin =
  originFromEnv(process.env.NEXT_PUBLIC_SUPABASE_URL) ||
  "https://*.supabase.co";

const remoteImageHosts = [
  "images.unsplash.com",
  "www.launchuicomponents.com",
  "farmui.vercel.app",
];

const allowUnsafeEval = process.env.NODE_ENV !== "production";

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${allowUnsafeEval ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: ${supabaseOrigin} ${remoteImageHosts
    .map((host) => `https://${host}`)
    .join(" ")}`,
  `connect-src 'self' ${supabaseOrigin}`,
  `font-src 'self' data:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join("; ");

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-accordion",
      "@radix-ui/react-dialog",
      "@radix-ui/react-label",
      "@radix-ui/react-select",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
    ],
  },
  images: {
    remotePatterns: remoteImageHosts.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  async headers() {
    const locked = process.env.PREVIEW_LOCK === "1";
    const baseHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
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
