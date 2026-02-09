"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];

export default function VCardShare({
  handle,
  label = "Share contact",
  className,
  variant,
}: {
  handle: string;
  label?: string;
  className?: string;
  variant?: ButtonVariant;
}) {
  const hrefBase = `/api/vcard/${encodeURIComponent(handle)}`;
  const [sharing, setSharing] = React.useState(false);
  const [supported, setSupported] = React.useState(false);

  function buildFreshHref() {
    return `${hrefBase}?download=${Date.now()}`;
  }

  React.useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  async function share() {
    if (typeof navigator === "undefined" || !navigator.share) return;
    const href = buildFreshHref();
    try {
      setSharing(true);
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) {
        window.location.assign(href);
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], `${handle}.vcf`, { type: "text/vcard" });
      const payload: ShareData = {
        files: [file],
        title: label,
      };
      if (navigator.canShare && !navigator.canShare(payload)) {
        window.location.assign(href);
        return;
      }
      await navigator.share(payload);
    } finally {
      setSharing(false);
    }
  }

  if (!supported) return null;

  return (
    <Button
      onClick={share}
      disabled={sharing}
      aria-label={label}
      title={label}
      className={className}
      variant={variant}
    >
      {sharing ? "Preparing..." : label}
    </Button>
  );
}
