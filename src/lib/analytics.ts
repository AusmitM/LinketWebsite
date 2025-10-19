/**
 * Minimal analytics helper that reads data-analytics-id from events.
 * Usage: add data-analytics-id to actionable elements. Optionally add
 * data-analytics-meta="{\"key\":\"value\"}" for extra info.
 */
export type AnalyticsPayload = {
  id: string
  meta?: Record<string, unknown>
}

export function track(el: HTMLElement) {
  const id = el.getAttribute("data-analytics-id")
  if (!id) return
  let meta: Record<string, unknown> | undefined
  const raw = el.getAttribute("data-analytics-meta")
  if (raw) {
    try {
      meta = JSON.parse(raw)
    } catch {
      // ignore
    }
  }
  const payload: AnalyticsPayload = { id, meta }
  // In production, send to your endpoint or provider.
  if (typeof window !== "undefined") {
    console.info("analytics", payload)
    window.dispatchEvent(new CustomEvent("analytics:event", { detail: payload }))
  }
}

export function bindAnalyticsClicks(root: Document | HTMLElement = document) {
  const handler = (e: Event) => {
    const target = e.target as HTMLElement
    if (!target) return
    const el = target.closest<HTMLElement>("[data-analytics-id]")
    if (el) track(el)
  }
  root.addEventListener("click", handler)
  return () => root.removeEventListener("click", handler)
}
