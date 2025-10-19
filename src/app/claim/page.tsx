"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, LogIn, RefreshCw, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/system/toaster";
import { supabase } from "@/lib/supabase";

export default function ClaimPage() {
  return (
    <Suspense fallback={<ClaimPageFallback />}>
      <ClaimPageContent />
    </Suspense>
  );
}

function ClaimPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTag = useMemo(() => searchParams.get("tag") ?? "", [searchParams]);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [chipUid, setChipUid] = useState(() => initialTag);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setChipUid(initialTag);
  }, [initialTag]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) {
        return;
      }
      setUserId(data.user?.id ?? null);
      setEmail(data.user?.email ?? null);
    })();

    return () => {
      active = false;
    };
  }, []);

  const loginHref = useMemo(() => {
    const redirect = `/claim?tag=${encodeURIComponent(initialTag)}`;
    return `/auth?next=${encodeURIComponent(redirect)}&view=signin`;
  }, [initialTag]);

  async function handleClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      toast({ title: "Sign in required", description: "Log in to claim your Linket.", variant: "destructive" });
      return;
    }

    if (!chipUid.trim()) {
      setErrorMessage("Enter your Linket claim code.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResult("idle");

    try {
      const response = await fetch("/api/linkets/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, chipUid: chipUid.trim() }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error((body?.error as string) || "Unable to claim Linket");
      }

      toast({ title: "Linket claimed", description: "Assign a profile in your dashboard.", variant: "success" });
      setResult("success");
      router.push("/dashboard/linkets");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to claim Linket";
      setErrorMessage(message);
      setResult("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[color-mix(in_srgb,var(--background) 90%,#eff4ff)] px-4 py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.12),_transparent_55%)]" aria-hidden />
      <Card className="relative w-full max-w-2xl border border-border/60 bg-card/80 shadow-xl backdrop-blur">
        <CardHeader className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <ShieldCheck className="h-4 w-4" />
            Claim your Linket
          </div>
          <CardTitle className="font-display text-3xl">Pair your physical Linket with your profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tap the tag once. If you see this page, the tag is ready to claim. Sign in or create an account to link it to your dashboard.
          </p>
        </CardHeader>
        <CardContent className="space-y-8">
          {!userId ? (
            <div className="space-y-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 text-primary">
                <LogIn className="h-4 w-4" />
                Log in to finish claiming your Linket.
              </p>
              <Link href={loginHref} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                Go to sign in
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleClaim}>
              <div className="space-y-2">
                <Label htmlFor="chipUid" className="text-sm font-medium">
                  Linket claim code
                </Label>
                <Input
                  id="chipUid"
                  value={chipUid}
                  onChange={(event) => setChipUid(event.target.value)}
                  placeholder="e.g., ABC123"
                  autoComplete="off"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Hint: the code is printed with your Linket or embedded in the NFC tap link.
                </p>
                {errorMessage && (
                  <p className="flex items-center gap-2 text-xs font-medium text-rose-600">
                    <AlertCircle className="h-4 w-4" /> {errorMessage}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Signed in as <strong>{email}</strong>
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUserId(null);
                    setEmail(null);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> switch account
                </button>
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Claiming...
                  </span>
                ) : (
                  "Claim Linket"
                )}
              </Button>
            </form>
          )}

          <section className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
            <h2 className="mb-3 text-sm font-semibold text-foreground">How claiming works</h2>
            <ol className="space-y-2 pl-5">
              <li className="list-decimal">Tap your Linket or enter its claim code above.</li>
              <li className="list-decimal">Sign in so we can add the Linket to your dashboard.</li>
              <li className="list-decimal">Assign it to any profile and update it anytime.</li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              Already claimed? A scan will jump straight to your public profile after assignment.
            </p>
          </section>

          {result === "success" && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Linket claimed successfully. Redirecting to dashboard...
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function ClaimPageFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[color-mix(in_srgb,var(--background) 90%,#eff4ff)] px-4 py-20">
      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading claim details...
      </div>
    </main>
  );
}
