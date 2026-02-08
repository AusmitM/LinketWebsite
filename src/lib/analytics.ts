export type AnalyticsPayload = {
  id: string;
  meta?: Record<string, unknown>;
  path?: string | null;
  href?: string | null;
  referrer?: string | null;
  timestamp: string;
};

export const ANALYTICS_EVENT_NAME = "analytics:event";
export const ANALYTICS_BROADCAST_KEY = "linket:analytics:last-event";

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

export function emitAnalyticsEvent(
  payload: Pick<AnalyticsPayload, "id"> & Partial<AnalyticsPayload>
) {
  if (typeof window === "undefined") return;

  const id = payload.id.trim();
  if (!id) return;

  const eventPayload: AnalyticsPayload = {
    id,
    meta: payload.meta,
    path: payload.path ?? window.location.pathname,
    href: payload.href ?? window.location.href,
    referrer:
      payload.referrer ??
      (typeof document !== "undefined" ? document.referrer || null : null),
    timestamp: payload.timestamp ?? new Date().toISOString(),
  };

  window.dispatchEvent(
    new CustomEvent(ANALYTICS_EVENT_NAME, { detail: eventPayload })
  );

  try {
    localStorage.setItem(
      ANALYTICS_BROADCAST_KEY,
      JSON.stringify({
        id: eventPayload.id,
        timestamp: eventPayload.timestamp,
        nonce: Math.random().toString(36).slice(2),
      })
    );
  } catch {
    // Ignore storage failures (private browsing / restricted storage).
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
  emitAnalyticsEvent(payload);
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
