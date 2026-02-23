const DEV_FALLBACK_SECRET = "devsalt";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET?.trim() ?? "";

export function sanitizeHttpUrl(raw: string) {
  const parsed = new URL(raw);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Bad scheme");
  }
  return parsed.toString();
}

export function parseDevice(ua: string) {
  const value = ua.toLowerCase();
  if (/(bot|crawler|spider)/.test(value)) return "bot";
  if (/(mobile|iphone|android(?!.*tablet))/.test(value)) return "mobile";
  if (/(ipad|tablet)/.test(value)) return "tablet";
  return "desktop";
}

export function hostOnly(ref: string | null) {
  if (!ref) return "";
  try {
    return new URL(ref).host;
  } catch {
    return "";
  }
}

export async function getDailySalt() {
  // Rotates daily to reduce long-lived correlation while keeping short-term rate limiting stable.
  const dayKey = new Date().toISOString().slice(0, 10);
  const baseSecret =
    INTERNAL_SECRET ||
    (process.env.NODE_ENV !== "production" ? DEV_FALLBACK_SECRET : "");
  return baseSecret ? `${baseSecret}:${dayKey}` : dayKey;
}

export async function hashIp(ip?: string) {
  const salt = await getDailySalt();
  const data = new TextEncoder().encode(`${ip ?? "0.0.0.0"}|${salt}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
