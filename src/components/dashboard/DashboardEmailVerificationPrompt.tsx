"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MailCheck } from "lucide-react";

import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { toast } from "@/components/system/toaster";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSiteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/client";

const DISMISS_KEY_PREFIX = "linket:dashboard-email-verification-dismissed:";
const DASHBOARD_ENTRY_PATH = "/dashboard/overview";

export default function DashboardEmailVerificationPrompt() {
  const dashboardUser = useDashboardUser();
  const supabase = useMemo(() => createClient(), []);
  const siteOrigin = useMemo(() => getSiteOrigin(), []);
  const [open, setOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [emailConfirmedAt, setEmailConfirmedAt] = useState<string | null>(
    dashboardUser?.email_confirmed_at ?? null
  );

  const userId = dashboardUser?.id ?? null;
  const userEmail = dashboardUser?.email ?? null;
  const dismissKey = userId ? `${DISMISS_KEY_PREFIX}${userId}` : null;
  const isVerified = Boolean(emailConfirmedAt);

  useEffect(() => {
    setEmailConfirmedAt(dashboardUser?.email_confirmed_at ?? null);
  }, [dashboardUser?.email_confirmed_at]);

  useEffect(() => {
    if (!dismissKey || typeof window === "undefined") {
      setOpen(false);
      return;
    }
    if (!userEmail || isVerified) {
      window.sessionStorage.removeItem(dismissKey);
      setOpen(false);
      return;
    }
    const dismissed = window.sessionStorage.getItem(dismissKey) === "1";
    setOpen(!dismissed);
  }, [dismissKey, isVerified, userEmail]);

  const refreshVerificationState = useCallback(
    async (showFeedback: boolean) => {
      if (!userId) return;
      setRefreshing(true);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const confirmedAt = data.user?.email_confirmed_at ?? null;
        setEmailConfirmedAt(confirmedAt);
        if (confirmedAt) {
          if (dismissKey && typeof window !== "undefined") {
            window.sessionStorage.removeItem(dismissKey);
          }
          setOpen(false);
          if (showFeedback) {
            toast({
              title: "Email verified",
              description: "Your account is verified and fully secured.",
              variant: "success",
            });
          }
          return;
        }
        if (showFeedback) {
          toast({
            title: "Still pending verification",
            description: "Open your inbox and click the verification link first.",
            variant: "default",
          });
        }
      } catch (error) {
        if (showFeedback) {
          const description =
            error instanceof Error ? error.message : "Unable to refresh verification status.";
          toast({
            title: "Verification check failed",
            description,
            variant: "destructive",
          });
        }
      } finally {
        setRefreshing(false);
      }
    },
    [dismissKey, supabase, userId]
  );

  useEffect(() => {
    if (!userId || isVerified) return;

    const handleFocus = () => {
      void refreshVerificationState(false);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshVerificationState(false);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isVerified, refreshVerificationState, userId]);

  const dismissPrompt = useCallback(() => {
    if (dismissKey && typeof window !== "undefined") {
      window.sessionStorage.setItem(dismissKey, "1");
    }
    setOpen(false);
  }, [dismissKey]);

  const handleResendVerification = useCallback(async () => {
    if (!userEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: userEmail,
        options: {
          emailRedirectTo: `${siteOrigin}/auth/callback?next=${encodeURIComponent(
            DASHBOARD_ENTRY_PATH
          )}`,
        },
      });
      if (error) throw error;
      toast({
        title: "Verification email sent",
        description: "Check your inbox for the verification link.",
        variant: "success",
      });
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unable to resend verification email.";
      toast({
        title: "Couldn't resend email",
        description,
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  }, [siteOrigin, supabase, userEmail]);

  if (!userId || !userEmail || isVerified) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isVerified) {
          dismissPrompt();
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <DialogContent className="rounded-2xl border border-border/60 bg-card/95 shadow-xl sm:max-w-xl">
        <DialogHeader className="space-y-3 text-left">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background">
            <MailCheck className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Verify your email
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            You are already in your dashboard. Verify your email from your inbox to
            secure your account and keep recovery options active.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
          Verification email sent to <span className="font-semibold text-foreground">{userEmail}</span>.
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={dismissPrompt}>
            Remind me later
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={refreshing}
              onClick={() => void refreshVerificationState(true)}
            >
              {refreshing ? "Checking..." : "I've verified"}
            </Button>
            <Button
              type="button"
              disabled={resending}
              onClick={() => void handleResendVerification()}
            >
              {resending ? "Sending..." : "Resend email"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
