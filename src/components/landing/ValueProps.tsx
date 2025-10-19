import { Card, CardContent } from "@/components/ui/card"
import { ContactRound, Palette, ShieldCheck } from "lucide-react"

export default function ValueProps() {
  const items = [
    { icon: ContactRound, title: "Tap to connect", body: "Instant NFC profile share with QR fallback.", href: "#features" },
    { icon: Palette, title: "Make it yours", body: "Pick colors, add initials or your logo.", href: "#features" },
    { icon: ShieldCheck, title: "Built to last", body: "Durable, water-resistant and scratch-safe.", href: "#features" },
  ]
  return (
    <section id="usp" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <Card key={it.title} className="rounded-2xl">
            <CardContent className="p-6">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary)]/30 to-[var(--accent)]/30">
                <it.icon className="h-5 w-5" />
              </div>
              <div className="text-base font-medium">{it.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{it.body}</p>
              <a href={it.href} className="mt-3 inline-block text-sm text-foreground underline underline-offset-4">Learn more</a>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
