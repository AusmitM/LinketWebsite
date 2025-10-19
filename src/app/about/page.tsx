import Link from "next/link";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 md:px-6">
      <header className="mb-8 space-y-2">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Our story</p>
        <h1 className="text-3xl font-semibold text-[#0f172a]">Why we built Linket</h1>
        <p className="text-sm text-muted-foreground">A founder letter from Punit and the Linket crew.</p>
      </header>

      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardContent className="space-y-4 p-6 text-sm text-slate-700 md:p-8">
          <p>
            Hey, I’m Punit. Linket started as a side project after watching friends swap paper business cards that hit the recycling bin hours later. We wanted a way to share who you are that felt as personal as the conversation you just had.
          </p>
          <p>
            We tested a handful of NFC tags at a campus career fair. Forty-seven taps later we realized the hardware wasn’t the magic—it was the experience: the pastel gradient that matched Maya’s portfolio, the instant tap-to-follow for Leo’s pop-up, the way hospitality teams swapped menus mid-shift. Linket became the tap-forward introduction that keeps the story going.
          </p>
          <p>
            Today we’re a tiny distributed team shipping from Seattle, LA, and Hyderabad. We believe your Linket should feel handcrafted, update in seconds, and never lock features behind subscriptions.
          </p>
          <p className="font-medium text-foreground">
            Thanks for being here. We read every idea, feature request, and shipping selfie you send.
          </p>
          <p>— Punit Kothakonda & the Linket crew</p>
        </CardContent>
      </Card>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl border bg-muted/40 p-6">
          <CardTitle className="text-base font-semibold text-[#0f172a]">Build with us</CardTitle>
          <CardContent className="mt-3 space-y-2 p-0 text-sm text-muted-foreground">
            <p>Join our beta community for template drops, feature previews, and co-design sessions.</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/contact?topic=community">Request an invite</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border bg-muted/40 p-6">
          <CardTitle className="text-base font-semibold text-[#0f172a]">Have an idea?</CardTitle>
          <CardContent className="mt-3 space-y-2 p-0 text-sm text-muted-foreground">
            <p>We ship fast because we ship together. Tell us what would make your Linket feel even more like you.</p>
            <Button asChild className="rounded-full">
              <Link href="mailto:hello@linket.io">hello@linket.io</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 rounded-3xl border bg-card/70 p-6 text-sm text-muted-foreground md:p-8">
        <h2 className="text-lg font-semibold text-[#0f172a]">Where we’re heading</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          <li>Self-serve template marketplace powered by our community.</li>
          <li>Deeper analytics integrations (HubSpot, Notion, Airtable).</li>
          <li>Reusable packaging program to keep Linkets in rotation, never landfill.</li>
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">Want to shape the roadmap? Hop into the concierge chat or email us. We’ll get back within a day.</p>
      </section>
    </main>
  );
}

