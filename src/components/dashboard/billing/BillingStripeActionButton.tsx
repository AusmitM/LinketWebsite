"use client";

import { useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";

type BillingStripeActionButtonProps = Omit<
  ComponentProps<typeof Button>,
  "asChild" | "onClick"
> & {
  href: string;
  idleLabel: string;
  pendingLabel?: string;
};

export default function BillingStripeActionButton({
  href,
  idleLabel,
  pendingLabel = "Redirecting to Stripe...",
  disabled,
  ...buttonProps
}: BillingStripeActionButtonProps) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      {...buttonProps}
      type="button"
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={() => {
        if (disabled || pending) return;
        setPending(true);
        window.location.assign(href);
      }}
    >
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}

