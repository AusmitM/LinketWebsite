"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/system/toaster";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { accountSecurity, brandingDefaults, notificationMatrix, dataPrivacyToolkit, accessibilityChecklist, hardwareFleet } from "@/lib/dashboard/mock-data";
import { Shield, Palette, Lock, Cpu } from "lucide-react";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default function SettingsContent() {
  const notify = (title: string, description: string) =>
    toast({ title, description });

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Account security</CardTitle>
              <p className="text-sm text-muted-foreground">Keep taps, messages, and billing locked down.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => notify("MFA", "Security center opening soon.")}
              >
                <Shield className="mr-1 h-4 w-4" /> Manage MFA
              </Button>
              <SignOutButton />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border p-3">
              <div className="flex items-center justify-between">
                <span>MFA enabled</span>
                <Badge variant="secondary" className="rounded-full">{accountSecurity.mfaEnabled ? "On" : "Off"}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Passkeys: {accountSecurity.passkeys}</p>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Active sessions</div>
              {accountSecurity.sessions.map((session) => (
                <div key={session.device} className="flex items-center justify-between rounded-2xl border px-3 py-2 text-xs">
                  <span>{session.device} · {session.location}</span>
                  <span className="text-muted-foreground">{session.lastActive}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Brand defaults</CardTitle>
            <p className="text-sm text-muted-foreground">Sync your public profile and vCard styling.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <Palette className="h-5 w-5 text-muted-foreground" />
              </span>
              <div>
                <div className="font-semibold text-foreground">Typeface: {brandingDefaults.typography}</div>
                <p className="text-xs text-muted-foreground">Logo + theme applied to new profiles automatically.</p>
              </div>
            </div>
            <div className="flex gap-2">
              {brandingDefaults.colors.map((color) => (
                <span key={color} className="h-6 w-6 rounded-full border" style={{ background: color }} />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Notification matrix</CardTitle>
            <p className="text-sm text-muted-foreground">Choose how your team gets alerts.</p>
          </CardHeader>
          <CardContent>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2">Channel</th>
                  <th className="px-3 py-2">Overview</th>
                  <th className="px-3 py-2">Analytics</th>
                  <th className="px-3 py-2">Orders</th>
                </tr>
              </thead>
              <tbody>
                {notificationMatrix.map((row) => (
                  <tr key={row.channel} className="border-b last:border-none">
                    <td className="px-3 py-2 text-sm font-medium text-foreground">{row.channel}</td>
                    <Cell value={row.overview} />
                    <Cell value={row.analytics} />
                    <Cell value={row.orders} />
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Privacy & compliance</CardTitle>
            <p className="text-sm text-muted-foreground">Export, erase, and manage consent logs.</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {dataPrivacyToolkit.map((item) => (
              <div key={item.id} className="rounded-2xl border px-3 py-2">
                <div className="font-semibold text-foreground">{item.label}</div>
                <p className="text-xs text-muted-foreground">{item.helper}</p>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => notify("Privacy center", "Manage exports and deletion requests.")}><Lock className="mr-1 h-4 w-4" /> Open privacy center</Button>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Hardware & accessibility</CardTitle>
            <p className="text-sm text-muted-foreground">Monitor your fleet and stay compliant.</p>
          </div>
          <Badge variant="secondary" className="rounded-full"><Cpu className="mr-1 h-4 w-4" /> Companion app live</Badge>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="text-xs uppercase text-muted-foreground">Fleet status</div>
            {hardwareFleet.map((device) => (
              <div key={device.id} className="rounded-2xl border px-3 py-2 text-sm">
                <div className="font-semibold text-foreground">{device.asset}</div>
                <p className="text-xs text-muted-foreground">{device.location} · Battery {device.battery}</p>
                <Badge variant="outline" className="mt-1 rounded-full text-[10px]">{device.status}</Badge>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="text-xs uppercase text-muted-foreground">Accessibility & trust</div>
            {accessibilityChecklist.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border px-3 py-2 text-sm">
                <span>{item.label}</span>
                <Badge variant="outline" className="rounded-full text-[10px]">{item.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ value }: { value: boolean }) {
  return (
    <td className="px-3 py-2 text-center">
      {value ? <Badge variant="secondary" className="rounded-full px-2">On</Badge> : <span className="text-muted-foreground">—</span>}
    </td>
  );
}
