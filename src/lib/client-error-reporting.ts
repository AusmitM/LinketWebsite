"use client";

export type ClientErrorPayload = {
  message: string;
  name?: string;
  stack?: string | null;
  source?: string | null;
  componentStack?: string | null;
  level?: "error" | "warning";
};

const RECENT_SIGNATURES = new Map<string, number>();
const DEDUPE_WINDOW_MS = 5000;

function normalize(value: string | null | undefined, limit = 2000) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.slice(0, limit);
}

function makeSignature(payload: ClientErrorPayload) {
  return [
    normalize(payload.name, 120),
    normalize(payload.message, 300),
    normalize(payload.source, 240),
    normalize(payload.componentStack, 240),
  ].join("|");
}

function shouldSend(signature: string) {
  const now = Date.now();
  const last = RECENT_SIGNATURES.get(signature) ?? 0;
  if (now - last < DEDUPE_WINDOW_MS) return false;
  RECENT_SIGNATURES.set(signature, now);
  for (const [key, seenAt] of RECENT_SIGNATURES.entries()) {
    if (now - seenAt > DEDUPE_WINDOW_MS * 6) {
      RECENT_SIGNATURES.delete(key);
    }
  }
  return true;
}

export function reportClientError(payload: ClientErrorPayload) {
  if (typeof window === "undefined") return;
  const message = normalize(payload.message, 2000);
  if (!message) return;

  const signature = makeSignature(payload);
  if (!shouldSend(signature)) return;

  const body = {
    message,
    name: normalize(payload.name, 160) || "Error",
    stack: normalize(payload.stack, 12000) || null,
    source: normalize(payload.source, 320) || null,
    componentStack: normalize(payload.componentStack, 12000) || null,
    level: payload.level === "warning" ? "warning" : "error",
    href: normalize(window.location.href, 1024),
    userAgent: typeof navigator !== "undefined" ? normalize(navigator.userAgent, 512) : "",
    timestamp: new Date().toISOString(),
  };

  void fetch("/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}
