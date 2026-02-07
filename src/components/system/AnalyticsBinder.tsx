"use client";

import { useEffect } from "react";
import { bindAnalyticsClicks } from "@/lib/analytics";

export default function AnalyticsBinder() {
  useEffect(() => bindAnalyticsClicks(document), []);
  return null;
}
