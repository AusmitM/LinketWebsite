"use client";

import { useEffect, useState } from "react";

import LeadsList from "@/components/dashboard/LeadsList";
import LeadFormBuilder from "@/components/dashboard/LeadFormBuilder";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";

export default function LeadsPage() {
  const dashboardUser = useDashboardUser();
  const userId = dashboardUser?.id ?? null;
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [fetchedHandle, setFetchedHandle] = useState<{
    userId: string;
    handle: string | null;
  } | null>(null);
  const handle = fetchedHandle?.userId === userId ? fetchedHandle.handle : null;

  useEffect(() => {
    let active = true;
    if (!userId) {
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const response = await fetch(
          `/api/account/handle?userId=${encodeURIComponent(userId)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          setFetchedHandle({ userId, handle: null });
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!active) return;
        setFetchedHandle({
          userId,
          handle: typeof payload?.handle === "string" ? payload.handle : null,
        });
      } catch {
        if (active) setFetchedHandle({ userId, handle: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setHasPaidAccess(false);
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const response = await fetch("/api/billing/summary", {
          cache: "no-store",
        });
        if (!active) return;
        if (!response.ok) {
          setHasPaidAccess(false);
          return;
        }
        const payload = (await response.json().catch(() => null)) as
          | { hasPaidAccess?: boolean }
          | null;
        setHasPaidAccess(Boolean(payload?.hasPaidAccess));
      } catch {
        if (active) setHasPaidAccess(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  if (!userId) {
    return (
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You need to be signed in to manage leads.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div data-tour="leads-inbox">
        <ErrorBoundary title="Leads inbox failed to load">
          <LeadsList userId={userId} />
        </ErrorBoundary>
      </div>
      <div data-tour="leads-form-builder">
        <ErrorBoundary title="Lead form builder failed to load">
          <LeadFormBuilder
            userId={userId}
            handle={handle}
            hasPaidAccess={hasPaidAccess}
            showPreview
            layout="side"
            columns={3}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
