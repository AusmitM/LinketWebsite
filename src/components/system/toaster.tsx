"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

export type ToastOptions = {
  id?: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "destructive";
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastInternal = Required<ToastOptions> & { id: string };

const TOAST_EVENT = "app:toast";

type ToastTone = {
  accent: string;
  icon: typeof Info;
  label: string;
};

function getToastTone(variant: ToastInternal["variant"]): ToastTone {
  if (variant === "success") {
    return { accent: "#22c55e", icon: CheckCircle2, label: "Success" };
  }
  if (variant === "destructive") {
    return { accent: "#ef4444", icon: AlertTriangle, label: "Error" };
  }
  return { accent: "#4f9ce8", icon: Info, label: "Notice" };
}

export function toast(opts: ToastOptions) {
  const detail: ToastInternal = {
    id: opts.id || Math.random().toString(36).slice(2),
    title: opts.title || "",
    description: opts.description || "",
    variant: opts.variant || "default",
    durationMs: opts.durationMs ?? 8200,
    actionLabel: opts.actionLabel || "",
    onAction: opts.onAction || (() => undefined),
  };
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail }));
  return detail.id;
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
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
  }, [dismiss]);

  // Avoid SSR markup so extensions cannot mutate this subtree before hydration
  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-start justify-end p-4 sm:p-6">
      <div className="flex w-full max-w-sm flex-col gap-3" aria-live="polite" aria-atomic>
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const tone = getToastTone(t.variant);
            const ToneIcon = tone.icon;

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  role="status"
                  aria-label={t.title || t.description}
                  className="uiverse-toast-shell pointer-events-auto"
                  style={
                    {
                      "--toast-accent": tone.accent,
                    } as CSSProperties
                  }
                >
                  <div className="uiverse-toast-card">
                    <div className="uiverse-toast-top-row">
                      <div className="uiverse-toast-icon-pill" aria-hidden>
                        <ToneIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="uiverse-toast-label">{tone.label}</div>
                        {t.title ? (
                          <div className="uiverse-toast-title">{t.title}</div>
                        ) : null}
                        {t.description ? (
                          <div className="uiverse-toast-description">
                            {t.description}
                          </div>
                        ) : null}
                      </div>

                      <button
                        aria-label="Dismiss notification"
                        className="uiverse-toast-dismiss"
                        onClick={() => dismiss(t.id)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {t.actionLabel ? (
                      <div className="mt-2 flex justify-end">
                        <button
                          className="uiverse-toast-action"
                          onClick={() => {
                            t.onAction?.();
                            dismiss(t.id);
                          }}
                        >
                          {t.actionLabel}
                        </button>
                      </div>
                    ) : null}

                    <div className="uiverse-toast-progress" aria-hidden />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default Toaster;
