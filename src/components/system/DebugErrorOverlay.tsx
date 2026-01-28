"use client";

import { useEffect, useMemo, useState } from "react";

type ErrorEntry = {
  id: string;
  time: string;
  message: string;
  stack?: string;
  source?: string;
};

function shouldShow() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "1";
}

export default function DebugErrorOverlay() {
  const enabled = useMemo(() => shouldShow(), []);
  const [errors, setErrors] = useState<ErrorEntry[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const push = (entry: Omit<ErrorEntry, "id" | "time">) => {
      setErrors((prev) => [
        ...prev,
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toISOString(),
          ...entry,
        },
      ]);
    };
    const onError = (event: ErrorEvent) => {
      push({
        message: event.message || "Unknown error",
        stack: event.error?.stack,
        source: event.filename ? `${event.filename}:${event.lineno ?? ""}:${event.colno ?? ""}` : undefined,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      push({
        message: reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection"),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[200] max-h-[45vh] overflow-auto rounded-2xl border border-red-200/60 bg-white/95 p-3 text-xs text-slate-900 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold text-red-700">Debug errors (debug=1)</div>
        <button
          type="button"
          className="rounded-md border border-red-200/60 bg-white px-2 py-1 text-[10px] font-semibold text-red-700"
          onClick={() => setErrors([])}
        >
          Clear
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {errors.length === 0 ? (
          <div className="text-slate-600">No client errors captured yet.</div>
        ) : (
          errors.map((err) => (
            <div key={err.id} className="rounded-lg border border-red-200/60 bg-white px-2 py-2">
              <div className="font-semibold text-red-700">{err.message}</div>
              {err.source ? (
                <div className="text-[10px] text-slate-500">{err.source}</div>
              ) : null}
              {err.stack ? (
                <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-slate-600">
                  {err.stack}
                </pre>
              ) : null}
              <div className="mt-1 text-[10px] text-slate-500">{err.time}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
