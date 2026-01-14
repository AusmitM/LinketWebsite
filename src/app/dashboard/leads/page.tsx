"use client";

import { useEffect, useState } from "react";

import LeadsList from "@/components/dashboard/LeadsList";
import LeadFormBuilder from "@/components/dashboard/LeadFormBuilder";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { Card, CardContent } from "@/components/ui/card";

export default function LeadsPage() {
  const dashboardUser = useDashboardUser();
  const userId = dashboardUser?.id ?? null;
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setHandle(null);
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
          setHandle(null);
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!active) return;
        setHandle(typeof payload?.handle === "string" ? payload.handle : null);
      } catch {
        if (active) setHandle(null);
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
      <LeadsList userId={userId} />
      <LeadFormBuilder
        userId={userId}
        handle={handle}
        showPreview
        layout="side"
        columns={3}
      />
    </div>
  );
}
