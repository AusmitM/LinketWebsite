import { Card, CardContent } from "@/components/ui/card"

const features = [
  { t: "One-tap share", d: "NFC + QR. No app needed." },
  { t: "Privacy controls", d: "Choose what to show." },
  { t: "Analytics snapshot", d: "See taps and CTR." },
  { t: "Durable build", d: "Water-resistant body." },
  { t: "Works anywhere", d: "Web links, socials, more." },
  { t: "Easy bulk order", d: "Teams and events ready." },
]

export default function FeatureGrid() {
  return (
    <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-3 text-sm text-muted-foreground">Live taps today: <Counter to={128} /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.t} className="rounded-2xl">
            <CardContent className="p-6">
              <div className="text-base font-medium" title={f.d}>#{f.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Counter({ to }: { to: number }) {
  return <span aria-live="polite">{to}</span>
}
