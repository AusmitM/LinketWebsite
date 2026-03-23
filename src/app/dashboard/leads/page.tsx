"use client";

import { useEffect, useState } from "react";
import { FileText, Inbox } from "lucide-react";

import LeadsList from "@/components/dashboard/LeadsList";
import LeadFormBuilder from "@/components/dashboard/LeadFormBuilder";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import ErrorBoundary from "@/components/system/ErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LeadsPage() {
  const dashboardUser = useDashboardUser();
  const userId = dashboardUser?.id ?? null;
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
    <Tabs defaultValue="leads" className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Leads
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Manage inbound contacts in a compact inbox, then switch to the form
            builder when you need to change what people submit.
          </p>
        </div>
        <TabsList className="h-auto rounded-full border border-border/60 bg-card/80 p-1 shadow-sm">
          <TabsTrigger value="leads" className="rounded-full px-4 py-2">
            <Inbox className="h-4 w-4" aria-hidden />
            Leads
          </TabsTrigger>
          <TabsTrigger value="builder" className="rounded-full px-4 py-2">
            <FileText className="h-4 w-4" aria-hidden />
            Form Builder
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="leads" data-tour="leads-inbox">
        <ErrorBoundary title="Leads inbox failed to load">
          <LeadsList userId={userId} />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="builder" data-tour="leads-form-builder">
        <ErrorBoundary title="Lead form builder failed to load">
          <LeadFormBuilder
            userId={userId}
            handle={handle}
            showPreview
            layout="side"
            columns={3}
          />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  );
}
