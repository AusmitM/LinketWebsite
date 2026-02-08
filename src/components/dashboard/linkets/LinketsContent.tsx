"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Tags,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { ProfileWithLinks } from "@/lib/profile-service";
import type { TagAssignmentDetail } from "@/lib/linket-tags";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/system/toaster";
import { cn } from "@/lib/utils";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";

type LinketsContentProps = {
  variant?: "standalone" | "embedded";
};

export default function LinketsContent({ variant = "standalone" }: LinketsContentProps) {
  const isEmbedded = variant === "embedded";
  const dashboardUser = useDashboardUser();
  const [userId, setUserId] = useState<string | null>(dashboardUser?.id ?? null);
  const [loading, setLoading] = useState(true);
  const [linkets, setLinkets] = useState<TagAssignmentDetail[]>([]);
  const [profiles, setProfiles] = useState<ProfileWithLinks[]>([]);
  const [claimCode, setClaimCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dashboardUser) {
      setUserId(dashboardUser.id ?? null);
    } else {
      setUserId(null);
    }
  }, [dashboardUser]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      setUserId(data.user?.id ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadData = useCallback(async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const [linketsRes, profilesRes] = await Promise.all([
        fetch(`/api/linkets?userId=${encodeURIComponent(uid)}`),
        fetch(`/api/linket-profiles?userId=${encodeURIComponent(uid)}`, { cache: "no-store" }),
      ]);
      if (!linketsRes.ok) {
        const body = await linketsRes.json().catch(() => null);
        throw new Error((body?.error as string) || "Unable to load Linkets");
      }
      if (!profilesRes.ok) {
        const body = await profilesRes.json().catch(() => null);
        throw new Error((body?.error as string) || "Unable to load profiles");
      }
      const linketsJson = (await linketsRes.json()) as TagAssignmentDetail[];
      const profilesJson = (await profilesRes.json()) as ProfileWithLinks[];
      setLinkets(linketsJson);
      setProfiles(profilesJson);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load Linkets";
      setError(message);
      toast({ title: "Linkets unavailable", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      void loadData(userId);
    }
  }, [userId, loadData]);

  const activeProfileOptions = useMemo(() => {
    return profiles.map((profile) => ({
      id: profile.id,
      label: profile.name,
      handle: profile.handle,
      isActive: profile.is_active,
    }));
  }, [profiles]);

  async function handleAssign(assignmentId: string, profileId: string | null) {
    if (!userId) return;
    try {
      const response = await fetch(`/api/linkets/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, profileId }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error((body?.error as string) || "Unable to update Linket");
      }
      toast({ title: "Linket updated", variant: "success" });
      await loadData(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update Linket";
      toast({ title: "Update failed", description: message, variant: "destructive" });
    }
  }

  async function handleRelease(assignmentId: string) {
    if (!userId) return;
    if (!confirm("Release this Linket? It will become claimable again.")) return;
    try {
      const response = await fetch(`/api/linkets/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "release" }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error((body?.error as string) || "Unable to release Linket");
      }
      toast({ title: "Linket released", variant: "success" });
      await loadData(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to release Linket";
      toast({ title: "Release failed", description: message, variant: "destructive" });
    }
  }

  async function submitClaim() {
    if (!userId) {
      toast({ title: "Sign in required", variant: "destructive" });
      return;
    }
    if (!claimCode.trim()) {
      toast({ title: "Enter a claim code", variant: "destructive" });
      return;
    }
    setClaiming(true);
    try {
      const response = await fetch("/api/linkets/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, chipUid: claimCode.trim() }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error((body?.error as string) || "Unable to claim Linket");
      }
      setClaimCode("");
      toast({ title: "Linket claimed", description: "Assign a profile below.", variant: "success" });
      await loadData(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to claim Linket";
      toast({ title: "Claim failed", description: message, variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  }

  const emptyState = !loading && linkets.length === 0;

  return (
    <section className={cn("space-y-6", isEmbedded && "space-y-4")} data-tour="linkets-root">
      <Card
        className={cn(
          "border border-border/60 bg-card/80 shadow-sm",
          isEmbedded && "bg-card/70"
        )}
      >
        <CardHeader
          className={cn(
            "linkets-card-header flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between",
            isEmbedded && "gap-2.5"
          )}
        >
          <div>
            <CardTitle
              className={cn(
                "flex items-center gap-2 text-2xl font-semibold text-foreground",
                isEmbedded && "text-lg"
              )}
            >
              <Tags className="h-5 w-5" /> Linkets
            </CardTitle>
            <CardDescription>Manage every physical Linket tag tied to your account.</CardDescription>
          </div>
          <div className="linkets-refresh flex gap-2">
            <Button variant="outline" onClick={() => userId && loadData(userId)} className="rounded-full" aria-label="Refresh Linkets">
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            data-tour="linkets-claim"
            className="grid gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 md:grid-cols-[minmax(0,260px)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void submitClaim();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="claim-code" className="text-sm font-medium text-primary">
                Claim with a code
              </Label>
              <Input
                id="claim-code"
                placeholder="e.g., ABC123"
                value={claimCode}
                onChange={(event) => {
                  const nextValue = event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "");
                  setClaimCode(nextValue);
                }}
                disabled={claiming}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Use this if you cannot tap the tag right now. Codes are printed with each Linket.
              </p>
            </div>
            <div className="flex items-end justify-end md:justify-start">
              <Button
                type="submit"
                className="rounded-full text-foreground"
                disabled={claiming}
              >
                {claiming ? (
                  <span className="inline-flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming...
                  </span>
                ) : (
                  "Claim Linket"
                )}
              </Button>
            </div>
          </form>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <div data-tour="linkets-list">
            {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your Linkets...
            </div>
          ) : emptyState ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              No Linkets claimed yet. Claim one above to get started.
            </div>
          ) : (
            <div className="grid gap-4">
              {linkets.map((item) => {
                const assignedProfileId = item.assignment.profile_id;
                const activeProfile = assignedProfileId
                  ? activeProfileOptions.find((profile) => profile.id === assignedProfileId)
                  : null;
                return (
                  <div
                    key={item.assignment.id}
                    className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">
                          {item.assignment.nickname || `Linket ${item.tag.chip_uid}`}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Chip ID: <code className="font-mono text-[11px]">{item.tag.chip_uid}</code>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Status: {item.tag.status === "claimed" ? "Active" : item.tag.status}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 text-sm md:flex-row md:items-center">
                        <div className="flex items-center gap-2">
                          <Select
                            value={assignedProfileId ?? "default"}
                            onValueChange={(value) =>
                              handleAssign(
                                item.assignment.id,
                                value === "default" ? null : value
                              )
                            }
                          >
                            <SelectTrigger className="min-w-[220px]">
                              <SelectValue placeholder="Assign a profile" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Active profile (default)</SelectItem>
                              {activeProfileOptions.map((profile) => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.label} {profile.isActive ? "•" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {activeProfile ? (
                            <Link
                              href={`/${activeProfile.handle}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" /> View
                            </Link>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-xs text-rose-600 hover:underline"
                          onClick={() => handleRelease(item.assignment.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Release
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        </CardContent>
      </Card>

      <p
        className={cn(
          "text-xs text-muted-foreground",
          isEmbedded && "text-[11px] text-muted-foreground/75"
        )}
      >
        Need to claim a Linket without NFC? Tap the tools above or enter the printed code. Once claimed, you can reassign it to any profile anytime.
      </p>
    </section>
  );
}
