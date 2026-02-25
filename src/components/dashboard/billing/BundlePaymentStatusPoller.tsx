"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type BundlePaymentStatusPollerProps = {
  sessionId: string;
  enabled: boolean;
};

type BundleSessionStatusResponse = {
  status?: "processing" | "paid" | "failed";
};

export default function BundlePaymentStatusPoller({
  sessionId,
  enabled,
}: BundlePaymentStatusPollerProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "paid" | "failed">(
    "processing"
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const retryHref = useMemo(
    () => "/dashboard/billing?intent=bundle",
    []
  );

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const clearPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/billing/bundle-session-status?session_id=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => null)) as
          | BundleSessionStatusResponse
          | null;
        if (!active || !response.ok || !payload?.status) return;

        setStatus(payload.status);

        if (payload.status === "paid" || payload.status === "failed") {
          clearPolling();
          router.refresh();
        }
      } catch {
        // Ignore transient polling failures and keep trying.
      }
    };

    const startTimer = setTimeout(() => {
      if (!active) return;
      void poll();
      intervalRef.current = setInterval(() => {
        void poll();
      }, 8000);
    }, 10000);

    return () => {
      active = false;
      clearTimeout(startTimer);
      clearPolling();
    };
  }, [enabled, router, sessionId]);

  if (!enabled) return null;

  if (status === "paid") {
    return (
      <p className="rounded-2xl border border-emerald-300 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
        Bundle payment confirmed. Refreshing billing details...
      </p>
    );
  }

  if (status === "failed") {
    return (
      <p className="rounded-2xl border border-amber-300 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
        Bundle payment failed or expired.{" "}
        <a href={retryHref} className="font-semibold underline underline-offset-2">
          Retry checkout
        </a>
        .
      </p>
    );
  }

  return (
    <p className="rounded-2xl border border-blue-300 bg-blue-50/70 px-4 py-3 text-sm text-blue-950">
      Still processing payment with Stripe. This page will update automatically.
    </p>
  );
}
