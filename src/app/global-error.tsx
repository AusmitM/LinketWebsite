"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-error-reporting";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      message: error.message || "Global app error",
      name: error.name || "Error",
      stack: error.stack || null,
      source: error.digest ? `digest:${error.digest}` : "app/global-error",
      level: "error",
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-16">
          <section className="w-full rounded-3xl border border-border/60 bg-card/80 p-8 shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">
              Application error
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              A critical error occurred while rendering this page.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Reload page
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
