"use client";

import { useEffect } from "react";

import { trackEvent } from "@/lib/analytics";

export default function PublicProfileViewTracker({
  handle,
}: {
  handle: string;
}) {
  useEffect(() => {
    if (!handle) return;
    void trackEvent("public_profile_view", { handle });
  }, [handle]);

  return null;
}
