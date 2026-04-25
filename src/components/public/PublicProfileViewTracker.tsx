"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics";

const SKIP_ANALYTICS_PARAM = "skipAnalytics";

export default function PublicProfileViewTracker({
  handle,
}: {
  handle: string;
}) {
  useEffect(() => {
    if (!handle) return;
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const shouldSkip = url.searchParams.get(SKIP_ANALYTICS_PARAM) === "1";

    if (shouldSkip) {
      url.searchParams.delete(SKIP_ANALYTICS_PARAM);
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
      return;
    }

    void trackEvent("public_profile_view", { handle });
  }, [handle]);

  return null;
}
