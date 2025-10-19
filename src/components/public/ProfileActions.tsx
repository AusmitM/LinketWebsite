"use client";

import { Share2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/system/toaster";
import { cn } from "@/lib/utils";

type Props = {
  username: string;
  profileUrl: string;
  className?: string;
};

export function ProfileActions({ username, profileUrl, className }: Props) {
  return (
    <div className={cn("flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end", className)}>
      <Button
        className="w-full rounded-2xl sm:w-auto"
        aria-label="Share profile"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(profileUrl);
            toast({ title: "Profile URL copied", variant: "success" });
          } catch {
            toast({ title: "Failed to copy", variant: "destructive" });
          }
        }}
      >
        <Share2 className="mr-2 h-4 w-4" aria-hidden />
        Share profile
      </Button>
      <Button variant="outline" asChild className="w-full rounded-2xl sm:w-auto" aria-label="Save vCard">
        <a href={`/api/vcard/${encodeURIComponent(username)}`}>Save vCard</a>
      </Button>
      <details className="group relative w-full sm:w-auto">
        <summary className="flex cursor-pointer select-none items-center justify-center gap-2 rounded-2xl border border-transparent px-4 py-2 text-sm text-[color:var(--muted-foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--muted)]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]">
          <QrCode className="h-4 w-4" aria-hidden /> QR code
        </summary>
        <div className="absolute right-0 z-10 mt-2 w-48 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 shadow-[0_20px_45px_-35px_var(--ring)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(profileUrl)}`}
            alt="Profile QR code"
            width={160}
            height={160}
            className="h-auto w-full rounded-xl"
          />
        </div>
      </details>
    </div>
  );
}

export default ProfileActions;
