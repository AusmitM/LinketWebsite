"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/system/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { useDashboardUser } from "@/components/dashboard/DashboardSessionContext";
import { supabase } from "@/lib/supabase";
import { getSignedAvatarUrl } from "@/lib/avatar-client";
import { Phone } from "lucide-react";

type VCardFields = {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressRegion: string;
  addressPostal: string;
  addressCountry: string;
  note: string;
  photoData: string | null;
  photoName: string | null;
};

const EMPTY_FIELDS: VCardFields = {
  fullName: "",
  title: "",
  email: "",
  phone: "",
  company: "",
  addressLine1: "",
  addressLine2: "",
  addressCity: "",
  addressRegion: "",
  addressPostal: "",
  addressCountry: "",
  note: "",
  photoData: null,
  photoName: null,
};

export default function SettingsContent() {
  const router = useRouter();
  const user = useDashboardUser();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(true);
  const [savingPhone, setSavingPhone] = useState(false);
  const [vcardFields, setVcardFields] = useState<VCardFields>(EMPTY_FIELDS);

  const email = user?.email ?? "";
  const initials = useMemo(() => {
    if (email) return email.slice(0, 1).toUpperCase();
    return "L";
  }, [email]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setAvatarLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("avatar_url, updated_at")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!active) return;
        if (error) throw error;
        const signed = await getSignedAvatarUrl(
          data?.avatar_url ?? null,
          data?.updated_at ?? null
        );
        if (!active) return;
        setAvatarUrl(signed);
      } catch (error) {
        if (!active) return;
        console.warn("Settings avatar load failed:", error);
        setAvatarUrl(null);
      } finally {
        if (active) setAvatarLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setPhoneLoading(true);
      try {
        const response = await fetch(
          `/api/vcard/profile?userId=${encodeURIComponent(user.id)}`,
          { cache: "no-store" }
        );
        if (!response.ok) throw new Error("Unable to load phone");
        const payload = (await response.json()) as { fields?: VCardFields };
        if (!active) return;
        const fields = payload.fields ?? EMPTY_FIELDS;
        setVcardFields(fields);
        setPhone(fields.phone ?? "");
      } catch (error) {
        if (!active) return;
        console.warn("Settings phone load failed:", error);
      } finally {
        if (active) setPhoneLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to delete account");
      }
      toast({
        title: "Account deleted",
        description: "Your account has been removed.",
      });
      setDeleteOpen(false);
      router.push("/");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete account";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleSavePhone = async () => {
    if (!user?.id || savingPhone) return;
    setSavingPhone(true);
    try {
      const payload: VCardFields = {
        ...vcardFields,
        phone: phone.trim(),
      };
      const response = await fetch("/api/vcard/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, fields: payload }),
      });
      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to update phone");
      }
      setVcardFields(payload);
      toast({ title: "Phone updated", variant: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update phone";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border bg-card/80 shadow-sm" data-tour="settings-account">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-2xl font-semibold">Settings</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage your account details and contact info.
            </p>
          </div>
          <SignOutButton />
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,0.55fr)_minmax(0,1.45fr)]">
          <div className="flex items-center gap-4 rounded-2xl border border-border/60 bg-background/60 p-4">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border-2 border-[var(--accent)] bg-muted">
              {avatarLoading ? (
                <div className="dashboard-skeleton h-full w-full animate-pulse bg-muted" data-skeleton />
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                  {initials}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Account
              </div>
              <div className="text-sm font-semibold text-foreground">
                {email || "Email unavailable"}
              </div>
              <div className="text-xs text-muted-foreground">Signed in</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone number
              </div>
              <div className="mt-3 space-y-2">
                <Label htmlFor="settings-phone" className="text-xs text-muted-foreground">
                  This is used for your contact card.
                </Label>
                <Input
                  id="settings-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(formatPhoneNumber(event.target.value))}
                  onBlur={(event) => setPhone(formatPhoneNumber(event.target.value))}
                  placeholder="(555) 123 - 4567"
                  disabled={phoneLoading || !user?.id}
                />
                <Button
                  onClick={handleSavePhone}
                  disabled={phoneLoading || savingPhone || !user?.id}
                  className="rounded-full"
                >
                  {savingPhone ? "Saving..." : "Save phone"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-destructive/20 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-destructive">
            Danger zone
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="destructive"
            className="rounded-full"
            onClick={() => setDeleteOpen(true)}
          >
            Delete account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account</DialogTitle>
            <DialogDescription>
              This permanently deletes your account and removes your profile,
              links, lead forms, and stored images. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatPhoneNumber(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
}
