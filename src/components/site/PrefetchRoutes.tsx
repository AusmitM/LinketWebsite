"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

type ConnectionLike = {
  saveData?: boolean;
  effectiveType?: string;
};

function canPrefetchOnCurrentNetwork() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: ConnectionLike })
    .connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return connection.effectiveType !== "slow-2g" && connection.effectiveType !== "2g";
}

function getPrefetchTargets(pathname: string | null) {
  if (pathname === "/") return ["/auth"];
  if (pathname?.startsWith("/auth")) return ["/dashboard"];
  return [];
}

export default function PrefetchRoutes() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!canPrefetchOnCurrentNetwork()) return;

    const targets = getPrefetchTargets(pathname);
    if (targets.length === 0) return;

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
      requestIdle ? requestIdle(cb, { timeout: 2500 }) : window.setTimeout(cb, 1200);
    const cancel = (handle: number) =>
      cancelIdle ? cancelIdle(handle) : window.clearTimeout(handle);

    const handle = schedule(() => {
      if (document.visibilityState === "hidden") return;

      targets.forEach((route) => {
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

