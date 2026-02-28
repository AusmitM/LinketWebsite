"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type BillingTransientStateCleanerProps = {
  checkoutStatus: "success" | "cancel" | "incomplete" | "processing" | null;
  checkoutPurchase: "bundle" | null;
  checkoutSessionId: string | null;
  billingErrorCode: string | null;
};

export default function BillingTransientStateCleaner({
  checkoutStatus,
  checkoutPurchase,
  checkoutSessionId,
  billingErrorCode,
}: BillingTransientStateCleanerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    let timeoutMs: number | null = null;
    const keysToClear = new Set<string>();

    if (billingErrorCode) {
      timeoutMs = 9000;
      keysToClear.add("billingError");
    }

    if (
      checkoutStatus === "success" ||
      checkoutStatus === "cancel" ||
      checkoutStatus === "incomplete"
    ) {
      timeoutMs = timeoutMs === null ? 10000 : Math.min(timeoutMs, 10000);
      keysToClear.add("checkout");
      keysToClear.add("purchase");
      keysToClear.add("session_id");
    }

    if (
      checkoutStatus === "processing" &&
      checkoutPurchase === "bundle" &&
      !checkoutSessionId
    ) {
      timeoutMs = timeoutMs === null ? 12000 : Math.min(timeoutMs, 12000);
      keysToClear.add("checkout");
      keysToClear.add("purchase");
      keysToClear.add("session_id");
    }

    if (checkoutStatus === "processing" && checkoutPurchase !== "bundle") {
      timeoutMs = timeoutMs === null ? 12000 : Math.min(timeoutMs, 12000);
      keysToClear.add("checkout");
      keysToClear.add("purchase");
      keysToClear.add("session_id");
    }

    if (timeoutMs === null || keysToClear.size === 0) return;

    const timer = window.setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams.toString());
      let changed = false;

      for (const key of keysToClear) {
        if (!nextParams.has(key)) continue;
        nextParams.delete(key);
        changed = true;
      }

      if (!changed) return;
      const nextPath = nextParams.size
        ? `${pathname}?${nextParams.toString()}`
        : pathname;
      router.replace(nextPath, { scroll: false });
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [
    billingErrorCode,
    checkoutPurchase,
    checkoutSessionId,
    checkoutStatus,
    pathname,
    router,
    searchParams,
  ]);

  return null;
}
