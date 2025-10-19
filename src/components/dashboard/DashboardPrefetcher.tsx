"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const DASHBOARD_ROUTES = [
  "/dashboard",
  "/dashboard/linkets",
  "/dashboard/profiles",
  "/dashboard/analytics",
  "/dashboard/messages",
  "/dashboard/billing",
  "/dashboard/settings",
  "/dashboard/vcard",
];

export default function DashboardPrefetcher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    DASHBOARD_ROUTES.forEach((route) => {
      if (route === pathname) return;

      try {
        Promise.resolve(router.prefetch(route)).catch(() => {});
      } catch {
        // Prefetch is best effort.
      }
    });
  }, [router, pathname]);

  return null;
}
