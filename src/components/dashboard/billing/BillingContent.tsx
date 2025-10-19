"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/system/toaster";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { billingSummary, invoices, paymentMethods, addOnCatalog, monetizationStreams } from "@/lib/dashboard/mock-data";
import { CreditCard, Download, TrendingUp, PiggyBank } from "lucide-react";

export default function BillingContent() {
  const notify = (title: string, description: string) =>
    toast({ title, description });

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Plan & usage</CardTitle>
              <p className="text-sm text-muted-foreground">Hybrid tap-to-share CRM usage at a glance.</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => notify("Subscription", "Redirecting to plan management.")}>Manage subscription</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border p-4">
              <div>
                <div className="text-sm font-semibold text-foreground">{billingSummary.currentPlan.name}</div>
                <p className="text-xs text-muted-foreground">{billingSummary.currentPlan.price} · {billingSummary.currentPlan.seats} seats</p>
              </div>
              <Badge variant="secondary" className="rounded-full">Renews {billingSummary.currentPlan.renewsOn}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <UsageStat label="Taps" value={billingSummary.usage.taps.toLocaleString()} helper="Included in Launch plan" />
              <UsageStat label="Analytics seats" value={`${billingSummary.usage.analyticsSeats}/5`} helper="Upgrade for more" />
              <UsageStat label="Automations" value={billingSummary.usage.automations} helper="Journeys running" />
            </div>
            <div className="rounded-2xl border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Forecast next month: {billingSummary.forecast.nextMonth}. {billingSummary.forecast.note}.
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Payment methods</CardTitle>
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => notify("Add card", "Secure form opens in a modal.")}><CreditCard className="mr-1 h-4 w-4" /> Add card</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {paymentMethods.map((method) => (
              <div key={method.id} className="flex items-center justify-between rounded-2xl border p-3 text-sm">
                <div>
                  <div className="font-semibold text-foreground">{method.brand} ending in {method.last4}</div>
                  <p className="text-xs text-muted-foreground">Expires {method.expiry}</p>
                </div>
                {method.primary ? <Badge variant="outline" className="rounded-full">Primary</Badge> : <Button variant="ghost" size="sm" className="rounded-full" onClick={() => notify("Primary updated", "This payment method will become default.")}>Set primary</Button>}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Invoices</CardTitle>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => notify("Downloads", "Preparing invoice archive.")}><Download className="mr-1 h-4 w-4" /> Download all</Button>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between rounded-2xl border px-3 py-2">
                <div>
                  <div className="font-semibold text-foreground">{invoice.id}</div>
                  <p className="text-xs text-muted-foreground">{invoice.period}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground">{invoice.amount}</span>
                  <Badge variant="secondary" className="rounded-full">{invoice.status}</Badge>
                  <Button variant="ghost" size="sm" asChild className="rounded-full"><a href={invoice.url}>Receipt</a></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Add-ons & upgrades</CardTitle>
            <p className="text-sm text-muted-foreground">Boost journeys, analytics, and hardware support.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {addOnCatalog.map((addon) => (
              <div key={addon.id} className="rounded-2xl border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{addon.name}</span>
                  <Badge variant="outline" className="rounded-full">{addon.price}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{addon.description}</p>
                <Button variant="ghost" size="sm" className="mt-2 rounded-full" onClick={() => notify("Add-on selected", "We'll add this to your next invoice.")}>Add to plan</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Monetization hub</CardTitle>
            <p className="text-sm text-muted-foreground">Track earnings from sales, affiliates, and marketplace.</p>
          </div>
          <Badge variant="secondary" className="rounded-full"><TrendingUp className="mr-1 h-4 w-4" /> ROI 28% MoM</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {monetizationStreams.map((stream) => (
            <div key={stream.id} className="rounded-2xl border p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <PiggyBank className="h-4 w-4 text-muted-foreground" /> {stream.name}
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stream.value}</p>
              <p className="text-xs text-emerald-600">{stream.delta}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Connect Stripe Connect, Shopify, and affiliate networks to unify payouts.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UsageStat({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-2xl border bg-card/60 p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <p className="text-[10px] text-muted-foreground">{helper}</p>
    </div>
  );
}
