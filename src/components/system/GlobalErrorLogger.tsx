"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-reporting";

function sourceFromEvent(event: ErrorEvent) {
  if (!event.filename) return null;
  const line = Number.isFinite(event.lineno) ? event.lineno : null;
  const col = Number.isFinite(event.colno) ? event.colno : null;
  if (!line && !col) return event.filename;
  return `${event.filename}:${line ?? ""}:${col ?? ""}`;
}

export default function GlobalErrorLogger() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientError({
        message: event.message || "Unexpected client error",
        name: event.error?.name || "Error",
        stack: event.error?.stack || null,
        source: sourceFromEvent(event),
        level: "error",
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      if (reason instanceof Error) {
        reportClientError({
          message: reason.message || "Unhandled promise rejection",
          name: reason.name || "Error",
          stack: reason.stack || null,
          level: "error",
        });
        return;
      }
      reportClientError({
        message: String(reason ?? "Unhandled promise rejection"),
        name: "UnhandledRejection",
        level: "error",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
