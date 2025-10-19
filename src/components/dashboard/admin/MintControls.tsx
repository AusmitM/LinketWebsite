"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/system/toaster";

type MintControlsProps = {
  defaultQty: number;
  defaultLabel: string;
};

function sanitizeLabel(raw: string) {
  return raw.trim().slice(0, 64);
}

function makeFilenameFromHeader(header: string | null, fallback: string) {
  if (!header) return fallback;
  try {
    const match = header.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
    if (!match) return fallback;
    const value = decodeURIComponent(match[1].trim().replace(/^"|"$/g, ""));
    return value || fallback;
  } catch {
    return fallback;
  }
}

export default function MintControls({ defaultQty, defaultLabel }: MintControlsProps) {
  const router = useRouter();
  const [qty, setQty] = useState<number>(defaultQty);
  const [label, setLabel] = useState<string>(defaultLabel);
  const [pending, setPending] = useState(false);

  const filenameFallback = useMemo(() => {
    const safeLabel = sanitizeLabel(label) || new Date().toISOString().slice(0, 10);
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.min(qty, 20000)) : 1;
    return `linkets_${safeLabel.replace(/\s+/g, "_")}_${safeQty}.csv`;
  }, [label, qty]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const safeQty = Number.isFinite(qty) ? Math.max(1, Math.min(qty, 20000)) : 1;
    const safeLabel = sanitizeLabel(label) || new Date().toISOString().slice(0, 10);

    setPending(true);
    try {
      const params = new URLSearchParams({
        qty: String(safeQty),
        label: safeLabel,
      });

      const response = await fetch(`/api/admin/mint?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Mint failed");
      }

      const blob = await response.blob();
      const downloadName = makeFilenameFromHeader(response.headers.get("Content-Disposition"), filenameFallback);
      const url = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Batch minted",
        description: `Generated ${safeQty.toLocaleString()} Linkets (${safeLabel}).`,
        variant: "success",
      });

      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        title: "Mint failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="admin-mint-qty">Quantity</Label>
            <Input
              id="admin-mint-qty"
              type="number"
              min={1}
              max={20000}
              step={50}
              value={qty}
              onChange={(event) => setQty(Number(event.target.value))}
              className="max-w-xs"
              required
            />
            <p className="text-xs text-muted-foreground">Between 1 and 20,000 units per batch.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-mint-label">Batch label</Label>
            <Input
              id="admin-mint-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="2025-10-16"
              className="max-w-xs"
              required
            />
            <p className="text-xs text-muted-foreground">Shown in reports and exported CSV filename.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            CSV will include `public_token`, claim code (raw + display), and the Linket URL.
          </div>
          <div className="text-xs">
            Filename preview: <span className="font-mono text-foreground">{filenameFallback}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} className="rounded-full px-6">
            {pending ? "Minting…" : "Generate CSV"}
          </Button>
        </div>
      </form>
    </section>
  );
}
