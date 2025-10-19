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
    const targets = new Set<string>(MARKETING_ROUTES);
    targets.add(DASHBOARD_ENTRY);
    targets.forEach((route) => {
      if (route === pathname) return;

      try {
        Promise.resolve(router.prefetch(route)).catch(() => {});
      } catch {
        // Ignore prefetch failures; navigation will still work.
      }
    });
  }, [router, pathname]);

  return null;
}

