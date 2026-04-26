"use client";

import { FormEvent, useState } from "react";
import { Sparkles, Wrench } from "lucide-react";

import { toast } from "@/components/system/toaster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatClaimCodeDisplay } from "@/lib/linket-claim-code";

type RepairResult = {
  recipient: {
    id: string;
    email: string;
  };
  tag: {
    id: string;
    chipUid: string;
    claimCode: string | null;
  };
  assignmentId: string | null;
};

export default function ComplimentaryGrantManager() {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [linketLookup, setLinketLookup] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RepairResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    try {
      const response = await fetch("/api/admin/linkets/complimentary-grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipientEmail,
          linketLookup,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to repair complimentary access."
        );
      }

      setResult(payload as RepairResult);
      toast({
        title: "Complimentary access repaired",
        description: "The Linket was reassigned and complimentary Pro was granted.",
        variant: "success",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to repair complimentary access.";
      toast({
        title: "Repair failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <Card className="rounded-[28px] border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            <Wrench className="h-4 w-4" />
            Entitlement repair
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">
            Reassign a Linket and grant the 12-month complimentary window
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="complimentary-recipient-email">Recipient email</Label>
              <Input
                id="complimentary-recipient-email"
                type="email"
                value={recipientEmail}
                onChange={(event) => setRecipientEmail(event.target.value)}
                placeholder="recipient@example.com"
                required
              />
              <p className="text-xs text-muted-foreground">
                Must match an existing account in Supabase Auth.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="complimentary-linket-lookup">
                Linket ID, claim code, public token, or chip UID
              </Label>
              <Input
                id="complimentary-linket-lookup"
                value={linketLookup}
                onChange={(event) => setLinketLookup(event.target.value)}
                placeholder="ABCD-EFGH-IJKL"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use the identifier you actually have on hand. The backend will try the common Linket lookup fields.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                This action reassigns the Linket to the recipient, writes a recipient-side entitlement claim event, and applies complimentary billing protection if they already have Stripe billing.
              </p>
              <Button type="submit" className="rounded-full" disabled={pending}>
                {pending ? "Repairing..." : "Repair access"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border border-border/60 bg-card/80 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            Result
          </div>
          <CardTitle className="text-xl font-semibold text-foreground">
            Latest repair summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-950">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Recipient
                </div>
                <div className="mt-1 font-medium">{result.recipient.email}</div>
                <div className="text-xs text-emerald-800/80">{result.recipient.id}</div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Linket
                </div>
                <div className="mt-1 font-medium">{result.tag.chipUid}</div>
                <div className="text-xs text-emerald-800/80">
                  Claim code{" "}
                  <code className="font-mono">
                    {formatClaimCodeDisplay(result.tag.claimCode) || "Unavailable"}
                  </code>
                </div>
              </div>

              <div className="text-xs text-emerald-800/90">
                Assignment ID:{" "}
                <code className="font-mono">{result.assignmentId ?? "Unavailable"}</code>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-10 text-sm text-muted-foreground">
              No repair has been run in this session yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
