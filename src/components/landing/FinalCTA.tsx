import { Button } from "@/components/ui/button"

export default function FinalCTA() {
  return (
    <section id="cta" className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8">
        <svg viewBox="0 0 1440 80" width="100%" height="80" preserveAspectRatio="none"><path d="M0,80 C320,0 1120,160 1440,0 L1440,80 L0,80 Z" fill="url(#g)" /><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0%" stop-color="#7fc3e3" stop-opacity="0.25"/><stop offset="100%" stop-color="#ffd7c5" stop-opacity="0.25"/></linearGradient></defs></svg>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border bg-gradient-to-br from-[var(--primary)]/20 to-[var(--accent)]/20 p-8 text-center shadow-sm">
          <h3 className="text-2xl font-semibold">Ready to build yours?</h3>
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><a href="/customize">Customize yours</a></Button>
            <Button asChild variant="secondary" size="lg"><a href="#showcase">See designs</a></Button>
          </div>
        </div>
      </div>
    </section>
  )
}

