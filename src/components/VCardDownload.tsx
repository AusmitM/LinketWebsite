"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];

export default function VCardDownload({
  handle,
  label = "Save vCard",
  className,
  variant,
  iconSrc,
  iconAlt = "Site icon",
}: {
  handle: string;
  label?: string;
  className?: string;
  variant?: ButtonVariant;
  iconSrc?: string;
  iconAlt?: string;
}) {
  const hrefBase = `/api/vcard/${encodeURIComponent(handle)}`;
  const [downloading, setDownloading] = React.useState(false);

  function buildFreshHref() {
    return `${hrefBase}?download=${Date.now()}`;
  }

  async function download() {
    const href = buildFreshHref();
    void trackEvent("vcard_download_click", { handle });
    try {
      setDownloading(true);
      // iOS Safari doesn't support the download attribute reliably. Open URL directly.
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isIOS = /iP(hone|od|ad)/.test(ua);
      if (isIOS) {
        void trackEvent("vcard_download_success", { handle, mode: "ios_redirect" });
        window.location.assign(href);
        return;
      }
      // Fetch and trigger a Blob download so the filename is correct across browsers.
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) {
        // fallback navigation if headers blocked by CSP
        void trackEvent("vcard_download_success", { handle, mode: "redirect_fallback" });
        window.location.assign(href);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${handle}.vcf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      void trackEvent("vcard_download_success", { handle, mode: "blob" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 160) : "unknown";
      void trackEvent("vcard_download_failed", { handle, message });
      window.location.assign(href);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      onClick={download}
      disabled={downloading}
      aria-label={label}
      title={label}
      className={className}
      variant={variant}
    >
      {iconSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconSrc}
          alt={iconAlt}
          className="mr-2 h-4 w-4"
          aria-hidden
        />
      ) : null}
      {downloading ? "Preparing..." : label}
    </Button>
  );
}
