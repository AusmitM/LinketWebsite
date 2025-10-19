"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCustomization } from "@/components/providers/customization-provider";
import type { CSSProperties } from "react";

const HEADLINE_MAP = {
  student: "Share who you are in one effortless tap",
  creator: "Let your audience reach every link with zero friction",
  business: "Hand prospects an accessible tap card that works for everyone",
  event: "Make every badge a reusable digital guide",
  other: "Start sharing a profile that puts clarity first",
  "": "Start sharing a profile that puts clarity first",
} as const;

const SELLING_POINTS = [
  {
    title: "Clear at a glance",
    description: "Large type and high-contrast colours keep details legible indoors and out.",
  },
  {
    title: "No learning curve",
    description: "Setup takes minutes and works without installing an app or scanning instructions.",
  },
  {
    title: "Inclusive by default",
    description: "WCAG-friendly colour pairing and descriptive labels travel with every tap.",
  },
];

export default function Hero() {
  const { primaryColor, accentColor, initials, persona } = useCustomization();
  const heading = HEADLINE_MAP[persona] ?? HEADLINE_MAP.other;
  const previewStyle: CSSProperties = {
    backgroundImage: `linear-gradient(135deg, ${accentColor}, ${primaryColor})`,
  };
  const heroMinHeight = "max(560px, calc((100vw * 9 / 16) - 72px))";

  return (
    <section id="hero" className="border-b bg-background" style={{ minHeight: heroMinHeight }}>
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col justify-center gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-20">
        <div className="max-w-xl space-y-6 lg:justify-self-start">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Accessible NFC sharing</p>
          <h1 className="font-display text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {heading}
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Linket keychains centre clean typography, descriptive labels, and tactile materials so every conversation starts on equal footing. No flashing backgrounds or hidden controls--just a dependable way to share how to reach you.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/customize">Customize your keychain</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="#how">How it works</Link>
            </Button>
          </div>
          <dl className="mt-8 space-y-4">
            {SELLING_POINTS.map((item) => (
              <div key={item.title}>
                <dt className="text-sm font-semibold text-foreground">{item.title}</dt>
                <dd className="text-sm text-muted-foreground">{item.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="w-full max-w-md rounded-3xl border bg-card/80 p-6 shadow-sm" aria-label="Live preview of a personalized keychain">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Personal preview</span>
            <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primaryColor }} aria-hidden />
              NFC ready
            </span>
          </div>
          <div className="mt-4 aspect-[4/3] w-full rounded-2xl border shadow-sm" style={previewStyle}>
            <div className="flex h-full items-center justify-center">
              <span className="rounded-full bg-white/90 px-6 py-3 text-3xl font-semibold text-slate-900">
                {(initials || "LC").slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
          <figcaption className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>Colours and initials update instantly as you personalise your card.</p>
            <p>No autoplay video or flashing effects--just a clear preview of what arrives.</p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}



