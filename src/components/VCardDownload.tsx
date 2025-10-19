"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";

export default function VCardDownload({ handle, label = "Save vCard" }: { handle: string; label?: string }) {
  const href = `/api/vcard/${encodeURIComponent(handle)}`;
  const [downloading, setDownloading] = React.useState(false);

  async function download() {
    try {
      setDownloading(true);
      // iOS Safari doesn't support the download attribute reliably. Open URL directly.
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isIOS = /iP(hone|od|ad)/.test(ua);
      if (isIOS) {
        window.location.assign(href);
        return;
      }
      // Fetch and trigger a Blob download so the filename is correct across browsers.
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) {
        // fallback navigation if headers blocked by CSP
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
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button onClick={download} disabled={downloading} aria-label={label} title={label}>
      {downloading ? "Preparing…" : label}
    </Button>
  );
}
