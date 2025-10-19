"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const plans = [
  { name: "Starter", m: 19, y: 15, features: ["Single keychain", "Basic customization"] },
  { name: "Pro", m: 39, y: 32, features: ["Advanced customization", "Analytics"], badge: "Most popular" },
  { name: "Teams", m: 99, y: 82, features: ["Bulk order", "Admin tools"] },
]

export default function Pricing() {
  const [yearly, setYearly] = useState(false)
  return (
    <section id="pricing" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-4 inline-flex rounded-full border bg-background p-1 text-xs">
        <button className={`rounded-full px-3 py-1 ${!yearly ? "bg-[var(--primary)]/20" : ""}`} onClick={() => setYearly(false)}>Monthly</button>
        <button className={`rounded-full px-3 py-1 ${yearly ? "bg-[var(--primary)]/20" : ""}`} onClick={() => setYearly(true)}>Yearly</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.name} className={`rounded-2xl ${p.badge ? "ring-1 ring-[var(--ring)]/50" : ""}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{p.name}</CardTitle>
                {p.badge && <span className="rounded-full bg-[var(--accent)]/50 px-2 py-0.5 text-xs">{p.badge}</span>}
              </div>
              <div className="text-3xl font-semibold">${yearly ? p.y : p.m}<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
            </CardHeader>
            <CardContent>
              <ul className="mb-4 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {p.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <Button className="w-full" data-analytics-id="pricing_select_plan">Choose {p.name}</Button>
              <div className="mt-3 text-xs text-muted-foreground">Secure payments • 30-day money-back • Warranty</div>
              <div className="mt-2 text-xs"><a href="#contact" className="underline underline-offset-4">Need a custom quote?</a></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

