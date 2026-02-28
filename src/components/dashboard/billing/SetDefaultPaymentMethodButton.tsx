"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { toast } from "@/components/system/toaster";
import { Button } from "@/components/ui/button";
import { CSRF_HEADER_NAME, getBrowserCsrfToken } from "@/lib/csrf";

type SetDefaultPaymentMethodButtonProps = {
  paymentMethodId: string;
};

export default function SetDefaultPaymentMethodButton({
  paymentMethodId,
}: SetDefaultPaymentMethodButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;
    setPending(true);

    try {
      const csrfToken = getBrowserCsrfToken();
      const response = await fetch("/api/billing/payment-method/default", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {}),
        },
        body: JSON.stringify({ paymentMethodId }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to set default payment method.");
      }

      toast({
        title: "Default payment method updated",
        description: "This card will be used for future renewals.",
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to set default payment method.";
      toast({
        title: "Update failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="!rounded-full !border !border-slate-300 !bg-none !bg-white !text-slate-900 hover:!bg-slate-100 hover:!text-slate-900"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Saving..." : "Set default"}
    </Button>
  );
}
