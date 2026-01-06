"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const MARKETING_ROUTES = [
  "/pricing",
  "/contact",
  "/customize",
  "/stories",
  "/claim",
  "/auth",
];

const DASHBOARD_ENTRY = "/dashboard";

export default function PrefetchRoutes() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const targets =
      pathname === "/" ? ["/auth", "/customize"] : MARKETING_ROUTES;
    const targetSet = new Set<string>(targets);
    targetSet.add(DASHBOARD_ENTRY);
    const hasIdle = "requestIdleCallback" in window;
    const requestIdle = hasIdle
      ? (
          window as Window & {
            requestIdleCallback: (cb: () => void, opts?: { timeout?: number }) => number;
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
      requestIdle ? requestIdle(cb, { timeout: 2000 }) : window.setTimeout(cb, 1500);
    const cancel = (handle: number) =>
      cancelIdle ? cancelIdle(handle) : window.clearTimeout(handle);

    const handle = schedule(() => {
      targetSet.forEach((route) => {
        if (route === pathname) return;

        try {
          Promise.resolve(router.prefetch(route)).catch(() => {});
        } catch {
          // Ignore prefetch failures; navigation will still work.
        }
      });
    });

    return () => cancel(handle);
  }, [router, pathname]);

  return null;
}

