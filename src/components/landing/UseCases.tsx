"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCustomization } from "@/components/providers/customization-provider";
import type { Persona } from "@/components/providers/customization-provider";

type CaseItem = {
  title: string;
  description: string;
  persona: Persona;
  cta: { label: string; href: string };
};

const CASES: CaseItem[] = [
  {
    title: "Students",
    description: "Share resumes, portfolios, and clear follow-up links after career fairs or interviews.",
    persona: "student",
    cta: { label: "Student preset", href: "/customize?preset=student" },
  },
  {
    title: "Creators",
    description: "Send followers to your latest releases, booking form, or tip jar without extra steps.",
    persona: "creator",
    cta: { label: "Creator preset", href: "/customize?preset=creator" },
  },
  {
    title: "Hospitality",
    description: "Serve menus, Wi-Fi, and loyalty signups with descriptive buttons that work for everyone.",
    persona: "business",
    cta: { label: "Hospitality rollout", href: "/contact?topic=hospitality" },
  },
  {
    title: "Events",
    description: "Give attendees a reusable badge that links schedules, sponsors, and post-event surveys.",
    persona: "event",
    cta: { label: "Event kit", href: "/customize?preset=event" },
  },
];

export default function UseCases() {
  const { setPersona, persona } = useCustomization();

  function handlePersonaSelect(next: Persona) {
    setPersona(next);
  }

  return (
    <section id="use-cases" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
      <header className="mb-8 space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Made for every introduction</h2>
        <p className="text-sm text-muted-foreground">
          Choose a preset to see a live preview that reflects how your audience will experience the tap.
        </p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {CASES.map((item) => {
          const isActive = persona === item.persona;
          return (
            <article
              key={item.title}
              className={`flex h-full flex-col justify-between rounded-2xl border p-5 text-left shadow-sm ${
                isActive ? "border-primary" : "border-border"
              }`}
            >
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <div className="mt-6 flex flex-col gap-3 text-sm">
                <Button
                  asChild
                  size="sm"
                  className="justify-center"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => handlePersonaSelect(item.persona)}
                >
                  <Link href={item.cta.href}>{item.cta.label}</Link>
                </Button>
                <span className="text-xs text-muted-foreground">
                  {isActive ? "Preset applied to the live preview." : "Select to update the live preview."}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
