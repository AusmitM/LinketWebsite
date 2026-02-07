export type AnalyticsPayload = {
  id: string;
  meta?: Record<string, unknown>;
  path?: string | null;
  href?: string | null;
  referrer?: string | null;
  timestamp: string;
};

function parseMeta(raw: string | null) {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function buildPayload(id: string, meta?: Record<string, unknown>): AnalyticsPayload {
  const href = typeof window !== "undefined" ? window.location.href : null;
  const path = typeof window !== "undefined" ? window.location.pathname : null;
  const referrer =
    typeof document !== "undefined" ? document.referrer || null : null;
  return {
    id,
    meta,
    path,
    href,
    referrer,
    timestamp: new Date().toISOString(),
  };
}

async function postAnalytics(payload: AnalyticsPayload) {
  try {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
      cache: "no-store",
    });
  } catch {
    // Ignore analytics transport failures.
  }
}

export function track(el: HTMLElement) {
  const id = el.getAttribute("data-analytics-id");
  if (!id) return;
  const meta = parseMeta(el.getAttribute("data-analytics-meta"));
  void trackEvent(id, meta);
}

export async function trackEvent(
  id: string,
  meta?: Record<string, unknown>
): Promise<void> {
  if (!id.trim()) return;
  const payload = buildPayload(id.trim(), meta);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("analytics:event", { detail: payload }));
  }
  await postAnalytics(payload);
}

export function bindAnalyticsClicks(root: Document | HTMLElement = document) {
  const handler = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const element = target.closest<HTMLElement>("[data-analytics-id]");
    if (element) {
      track(element);
    }
  };
  root.addEventListener("click", handler);
  return () => root.removeEventListener("click", handler);
}
