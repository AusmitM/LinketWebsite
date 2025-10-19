"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export type ToastOptions = {
  id?: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
  durationMs?: number;
};

type ToastInternal = Required<ToastOptions> & { id: string };

const TOAST_EVENT = "app:toast";

export function toast(opts: ToastOptions) {
  const detail: ToastInternal = {
    id: opts.id || Math.random().toString(36).slice(2),
    title: opts.title || "",
    description: opts.description || "",
    variant: opts.variant || "default",
    durationMs: opts.durationMs ?? 3200,
  };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
  return detail.id;
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    function onToast(e: Event) {
      const ce = e as CustomEvent<ToastInternal>;
      const t = ce.detail;
      setToasts((list) => [...list, t]);
      if (t.durationMs > 0) {
        setTimeout(() => dismiss(t.id), t.durationMs);
      }
    }
    window.addEventListener(TOAST_EVENT, onToast as EventListener);
    return () => window.removeEventListener(TOAST_EVENT, onToast as EventListener);
  }, []);

  // Avoid SSR markup so extensions cannot mutate this subtree before hydration
  if (!mounted) return null;

  function dismiss(id: string) {
    setToasts((list) => list.filter((t) => t.id !== id));
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-end p-4 sm:p-6">
      <div className="flex w-full max-w-sm flex-col gap-3" aria-live="polite" aria-atomic>
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div
                role="status"
                aria-label={t.title || t.description}
                className="pointer-events-auto rounded-xl border bg-card p-4 text-card-foreground shadow-[var(--shadow-ambient)] outline-none"
                style={{
                  borderColor:
                    t.variant === "success"
                      ? "color-mix(in oklab, var(--success), #fff 70%)"
                      : t.variant === "destructive"
                      ? "color-mix(in oklab, var(--danger), #fff 70%)"
                      : "var(--border)",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{
                      background:
                        t.variant === "success"
                          ? "var(--success)"
                          : t.variant === "destructive"
                          ? "var(--danger)"
                          : "var(--brand-emphasis)",
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    {t.title && <div className="text-sm font-medium text-foreground">{t.title}</div>}
                    {t.description && (
                      <div className="mt-0.5 text-sm text-muted-foreground">{t.description}</div>
                    )}
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    className="rounded-full p-1 text-muted-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
                    onClick={() => dismiss(t.id)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Toaster;
