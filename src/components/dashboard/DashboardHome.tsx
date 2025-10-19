"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ContactForm from "@/components/ContactForm";
import type { ContactProfile } from "@/lib/profile.store";
import { toast } from "@/components/system/toaster";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import LeadsList from "@/components/dashboard/LeadsList";
import LeadFormBuilder from "@/components/dashboard/LeadFormBuilder";
import type { ThemeName } from "@/lib/themes";
import type { ProfileWithLinks } from "@/lib/profile-service";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

interface ActiveProfileSummary {
  id: string;
  name: string;
  handle: string;
  theme: ThemeName;
  headline: string | null;
  linksCount: number;
}

export default function DashboardHome({ initialContact, onSaveContact }: { initialContact: ContactProfile; onSaveContact: (p: ContactProfile) => Promise<void> }) {
  const dashboardUser = useDashboardUser();
  const [userId, setUserId] = useState<string | null | undefined>(dashboardUser?.id ?? undefined);
  const [profiles, setProfiles] = useState<ProfileWithLinks[]>([]);
  const [accountHandle, setAccountHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dashboardUser?.id) {
      setUserId(dashboardUser.id);
    }
  }, [dashboardUser]);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUserId(session?.user?.id ?? null);
    });

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        const user = data.user;
        if (!user) return;
        setUserId(user.id);
      })
      .catch(() => {
        if (active) setUserId(null);
      });

    return () => {
      active = false;
      sub.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (userId === undefined) {
      return;
    }
    if (userId === null) {
      setProfiles([]);
      setAccountHandle(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [profilesRes, handleRes] = await Promise.all([
          fetch(`/api/linket-profiles?userId=${encodeURIComponent(userId)}`, { cache: "no-store" }),
          fetch(`/api/account/handle?userId=${encodeURIComponent(userId)}`, { cache: "no-store" }),
        ]);

        if (!profilesRes.ok) throw new Error(`Failed to load profiles (${profilesRes.status})`);

        const raw = (await profilesRes.json()) as ProfileWithLinks[];
        const handlePayload = handleRes.ok ? await handleRes.json().catch(() => null) : null;
        if (cancelled) return;

        setProfiles(raw);
        if (handlePayload && typeof handlePayload.handle === "string") {
          setAccountHandle(handlePayload.handle);
        } else {
          setAccountHandle(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load profiles";
        toast({ title: "Profiles unavailable", description: message, variant: "destructive" });
        if (!cancelled) {
          setProfiles([]);
          setAccountHandle(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activeProfile: ActiveProfileSummary | null = useMemo(() => {
    if (!profiles.length) return null;
    const selected = profiles.find((profile) => profile.is_active) ?? profiles[0];
    if (!selected) return null;
    const linksCount = (selected.links ?? []).filter((link) => link.is_active).length;
    return {
      id: selected.id,
      name: selected.name,
      handle: selected.handle,
      headline: selected.headline ?? null,
      theme: (selected.theme as ThemeName) ?? "light",
      linksCount,
    };
  }, [profiles]);

  const publicUrl = useMemo(() => {
    if (!activeProfile) return null;
    const handle = accountHandle || activeProfile.handle;
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return `${base}/u/${encodeURIComponent(handle)}`;
  }, [activeProfile, accountHandle]);

  if (loading || userId === undefined) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading dashboard...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-24 animate-pulse rounded-xl bg-muted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (userId === null) {
    return (
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">You&apos;re not signed in.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="font-display">Welcome back!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeProfile ? (
            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">Active profile</p>
                  <h2 className="text-xl font-semibold text-foreground">{activeProfile.name}</h2>
                  <p className="text-sm text-muted-foreground">{accountHandle ? `linket.co/u/${accountHandle}` : `linket.co/u/${activeProfile.handle}`}</p>
                  {activeProfile.headline && (
                    <p className="mt-2 text-sm text-muted-foreground/90">{activeProfile.headline}</p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{activeProfile.linksCount}</span> links · Theme {activeProfile.theme}
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
              Create your first profile to activate your public page.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="rounded-full">
              <a href="/dashboard/profiles">Manage profiles</a>
            </Button>
            {publicUrl && (
              <Button asChild variant="secondary" className="rounded-full">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  View public profile
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <section id="vcard">
        <Card className="rounded-2xl">
          <div className="p-2">
            <VCardAccordion initialContact={initialContact} onSaveContact={onSaveContact} />
          </div>
        </Card>
      </section>

      <section id="leads">
        <LeadsList userId={userId} />
      </section>

      <section id="lead-form" className="pt-2">
        <LeadFormBuilder userId={userId} handle={accountHandle || activeProfile?.handle || ""} />
      </section>
    </div>
  );
}

function VCardAccordion({ initialContact, onSaveContact }: { initialContact: ContactProfile; onSaveContact: (p: ContactProfile) => Promise<void> }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="vcard">
        <AccordionTrigger>Contact Card (vCard)</AccordionTrigger>
        <AccordionContent>
          <div className="px-2 pb-2">
            <ContactForm initial={initialContact} onSave={onSaveContact} />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
