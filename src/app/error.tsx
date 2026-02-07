"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/client-error-reporting";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      message: error.message || "Route error",
      name: error.name || "Error",
      stack: error.stack || null,
      source: error.digest ? `digest:${error.digest}` : "app/error",
      level: "error",
    });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 py-16">
      <section className="w-full rounded-3xl border border-border/60 bg-card/80 p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We could not load this page right now. Try again or go back to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/overview">Dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
