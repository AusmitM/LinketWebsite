"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
};

const PREFETCH_TARGETS_BY_ROUTE: Record<string, string[]> = {
  "/dashboard": ["/dashboard/overview", "/dashboard/leads"],
  "/dashboard/overview": ["/dashboard/leads", "/dashboard/analytics"],
  "/dashboard/leads": ["/dashboard/overview", "/dashboard/profiles"],
  "/dashboard/profiles": ["/dashboard/leads", "/dashboard/linkets"],
  "/dashboard/linkets": ["/dashboard/profiles", "/dashboard/vcard"],
  "/dashboard/vcard": ["/dashboard/profiles", "/dashboard/settings"],
  "/dashboard/analytics": ["/dashboard/overview", "/dashboard/leads"],
  "/dashboard/settings": ["/dashboard/overview", "/dashboard/billing"],
  "/dashboard/billing": ["/dashboard/settings", "/dashboard/overview"],
  "/dashboard/messages": ["/dashboard/leads", "/dashboard/overview"],
};

function canPrefetchOnCurrentNetwork() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: ConnectionLike })
    .connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}

export default function DashboardPrefetcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!canPrefetchOnCurrentNetwork()) return;

    const key = pathname ?? "/dashboard";
    const targets =
      PREFETCH_TARGETS_BY_ROUTE[key] ?? PREFETCH_TARGETS_BY_ROUTE["/dashboard"];
    if (!targets.length) return;

    const hasIdle = "requestIdleCallback" in window;
    const requestIdle = hasIdle
      ? (
          window as Window & {
            requestIdleCallback: (
              cb: () => void,
              opts?: { timeout?: number }
            ) => number;
          }
        ).requestIdleCallback
      : null;
    const cancelIdle = "cancelIdleCallback" in window
      ? (
          window as Window & {
            cancelIdleCallback: (handle: number) => void;
          }
        ).cancelIdleCallback
      : null;

    const schedule = (cb: () => void) =>
      requestIdle ? requestIdle(cb, { timeout: 3000 }) : window.setTimeout(cb, 1400);
    const cancel = (handle: number) =>
      cancelIdle ? cancelIdle(handle) : window.clearTimeout(handle);

    const timers: number[] = [];
    const handle = schedule(() => {
      if (document.visibilityState === "hidden") return;
      targets.forEach((route, index) => {
        if (route === pathname) return;
        const timer = window.setTimeout(() => {
          try {
            Promise.resolve(router.prefetch(route)).catch(() => {});
          } catch {
            // Prefetch is best effort.
          }
        }, index * 250);
        timers.push(timer);
      });
    });

    return () => {
      cancel(handle);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [router, pathname]);

  return null;
}
