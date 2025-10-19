import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import {
  ArrowRight,
  CheckCircle2,
  Focus,
  LineChart,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Linket -- Tap once. Share everything.",
  description:
    "Linket keychains share your digital profile with a single tap. Customize the hardware, control every link, and see analytics from the very first introduction.",
  openGraph: {
    title: "Linket -- Tap once. Share everything.",
    description:
      "From the first tap to saved contact, Linket keeps intros warm. NFC + QR hardware, live editing, and analytics built for students, creators, and teams.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Linket hero preview showing NFC keychains floating above a phone.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tap once. Share everything.",
    description:
      "Linket is the customizable tap-to-share keychain that keeps your information current with every scan.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/linket-favicon.svg",
  },
};

const HERO_BENEFITS = ["Works with iPhone & Android", "Share in under 2 seconds", "Update anytime"] as const;

const HERO_STATS = [
  { label: "Profiles launched", value: "42k+" },
  { label: "Avg. save rate", value: "87%" },
  { label: "Teams activated", value: "1,200" },
] as const;

const SOCIAL_PROOF = ["AAcuisine", "Houston Bee Rescue", "East Bay Robotics", "Sunset Creative", "Brimstone Events"] as const;

type JourneyStep = {
  title: string;
  description: string;
  detail: string;
  icon: LucideIcon;
  accent: string;
};

const JOURNEY_STEPS: JourneyStep[] = [
  {
    title: "Invite with a tap",
    description: "Tap Linket on their phone or let them scan the QR fallback.",
    detail: "No app to receive -- everything opens in their browser instantly.",
    icon: Sparkles,
    accent: "from-sky-200/80 to-sky-100/40 text-sky-700",
  },
  {
    title: "Show the essentials",
    description: "Your hero links, galleries, and saved contact card appear at once.",
    detail: "Decide which blocks lead and guide every viewer to the next action.",
    icon: Focus,
    accent: "from-rose-200/80 to-rose-100/40 text-rose-700",
  },
  {
    title: "Stay remembered",
    description: "Linket keeps analytics so you know which intros stick.",
    detail: "Rescan-ready hardware means every follow-up uses the newest info.",
    icon: LineChart,
    accent: "from-emerald-200/80 to-emerald-100/40 text-emerald-700",
  },
];

type FeatureHighlight = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
};

const FEATURE_HIGHLIGHTS: FeatureHighlight[] = [
  {
    title: "Dual-share hardware",
    description: "Combine NFC with a precision-etched QR so every device can connect.",
    icon: Zap,
    accent: "bg-sky-500/10 text-sky-600",
  },
  {
    title: "Live profile editor",
    description: "Reorder blocks, add media, and publish instantly -- no new print runs.",
    icon: Sparkles,
    accent: "bg-violet-500/10 text-violet-600",
  },
  {
    title: "Verified analytics",
    description: "Track taps, link clicks, and saved contacts without invading privacy.",
    icon: LineChart,
    accent: "bg-emerald-500/10 text-emerald-600",
  },
  {
    title: "Team dashboards",
    description: "Assign Linkets, manage branding, and export lead data with one click.",
    icon: ShieldCheck,
    accent: "bg-amber-500/10 text-amber-600",
  },
];

type UseCase = {
  slug: string;
  title: string;
  eyebrow: string;
  body: string;
  highlights: string[];
  gradient: string;
};

const USE_CASES: UseCase[] = [
  {
    slug: "students",
    title: "Students & job-seekers",
    eyebrow: "Career-ready intros",
    body: "Keep your resume, portfolio, LinkedIn, and Calendly in one tap. Linket remembers every recruiter follow-up.",
    highlights: ["Portfolio ready", "QR for fairs", "Calendar booking"],
    gradient: "from-[#c8f7ff] to-[#fef6ff]",
  },
  {
    slug: "creators",
    title: "Creators & performers",
    eyebrow: "Link in real life",
    body: "Give fans your socials, tip jar, and merch in a single motion. Spotlight your latest drop with animated hero blocks.",
    highlights: ["Pinned releases", "One-tap tips", "Analytics heatmap"],
    gradient: "from-[#ffe4f0] to-[#fff9e8]",
  },
  {
    slug: "teams",
    title: "Teams & sales crews",
    eyebrow: "Field-ready hardware",
    body: "Equip every rep with branded hardware, admin-controlled messaging, and qualified lead routing from the first conversation.",
    highlights: ["CRM export", "Bulk branding", "Multi-admin controls"],
    gradient: "from-[#dffbe4] to-[#ebf2ff]",
  },
  {
    slug: "events",
    title: "Events & venues",
    eyebrow: "Badge-to-contact",
    body: "Upgrade badges with Linket overlays to collect leads, deliver agendas, and trigger SMS reminders on the spot.",
    highlights: ["Session feedback", "Lead capture", "Auto follow-up"],
    gradient: "from-[#fff1d6] to-[#e7f6ff]",
  },
];

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  result: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Every student left our career fair with Linket saved in their contacts. We saw a 4x increase in follow-up meetings.",
    name: "Jamila Reyes",
    role: "Director of Partnerships, CampusLoop",
    result: "4x follow-up rate",
  },
  {
    quote: "Linket lets our pop-up teams capture leads without juggling tablets. We close same-day sales because the info sticks.",
    name: "Evan Blake",
    role: "Retail Ops, Sundrift",
    result: "+63% qualified leads",
  },
  {
    quote: "The ability to push a new menu to every Linket overnight is the superpower our food truck collective needed.",
    name: "Mina Chen",
    role: "Founder, Night Market Co.",
    result: "Menu swaps in minutes",
  },
];

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "$35",
    cadence: "one-time",
    description: "One Linket keychain with NFC + QR, editable profile, and essential analytics.",
    features: ["Custom engraving", "Ships in 48 hours", "Unlimited taps"],
    cta: "Get Starter",
    href: "/pricing",
    featured: false,
  },
  {
    name: "Creator",
    price: "$60",
    cadence: "one-time",
    description: "Premium finishes, motion hero blocks, and spotlight layouts built for storytelling.",
    features: ["Video spotlight", "Pinned link layouts", "Audio embeds"],
    cta: "Design Yours",
    href: "/customize",
    featured: true,
  },
  {
    name: "Teams",
    price: "Talk to sales",
    cadence: "per member / month",
    description: "Bulk hardware portal, admin controls, lead capture, and CRM/webhook integrations.",
    features: ["Bulk order portal", "Lead routing rules", "CRM + CSV export"],
    cta: "Book a demo",
    href: "/contact",
    featured: false,
  },
] as const;

const FAQ = [
  {
    question: "Does Linket work with both iPhone and Android?",
    answer: "Yes. Modern phones tap via NFC and older devices can scan the etched QR. No downloads needed for either option.",
  },
  {
    question: "Do recipients need a Linket or an app?",
    answer: "No. Your Linket opens in the recipient&apos;s browser right away. They can save your contact, follow links, or book time instantly.",
  },
  {
    question: "Can I update my profile after printing?",
    answer: "Absolutely. Change your headline, links, colors, or media anytime. Every tap uses the latest version automatically.",
  },
  {
    question: "How fast do orders ship?",
    answer: "Single Linkets ship within 48 hours. Team and event kits include a dedicated concierge for rush coordination.",
  },
  {
    question: "Is data collection privacy-centered?",
    answer: "We only track what matters: tap counts, link clicks, and lead form submissions. No invasive tracking or retargeting pixels.",
  },
] as const;

export default function Home() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://linket.app";

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: siteUrl,
    logo: `${siteUrl}${brand.logo}`,
    sameAs: [
      "https://www.instagram.com/linket",
      "https://www.linkedin.com/company/linket",
      "https://www.tiktok.com/@linket",
    ],
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#f7f3ff] via-white to-[#e9f9ff] text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,204,229,0.28),_transparent_70%)] blur-3xl" />
        <div className="absolute -right-32 top-40 h-[540px] w-[540px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(164,216,255,0.22),_transparent_70%)] blur-3xl" />
        <div className="absolute inset-x-0 bottom-[-240px] h-[380px] bg-[radial-gradient(circle_at_center,_rgba(16,200,160,0.12),_transparent_70%)] blur-3xl" />
      </div>
      <HeroSection />
      <TrustedBy />
      <JourneySection />
      <ExperienceSection />
      <FeatureSection />
      <LiveDemoSection />
      <UseCasesSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
      <Script id="linket-faq-schema" type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </Script>
      <Script id="linket-organization-schema" type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </Script>
    </div>
  );
}
function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden pb-24 pt-28 sm:pt-32 lg:pb-32">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 sm:px-6 lg:flex-row lg:items-center">
        <div className="max-w-xl space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-primary shadow-sm shadow-primary/20">
            <Sparkles className="h-4 w-4" aria-hidden />
            Tap once. Share everything.
          </div>
          <Image
            src={brand.logo}
            alt={`${brand.name} logo`}
            width={160}
            height={48}
            className="h-10 w-auto"
            priority
          />
          <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Your intro should feel effortless -- Linket makes it unforgettable.
          </h1>
          <p className="text-lg text-muted-foreground">
            Linket keychains share your digital profile in seconds. Customize hardware, guide viewers through your story, and know exactly which intros convert.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild className="rounded-full px-7 py-3 text-base font-semibold shadow-[0_18px_35px_rgba(65,140,255,0.22)] transition hover:translate-y-[-2px]">
              <Link href="/customize">
                Design your Linket
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Link
              href="#demo"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-foreground/15 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/30 hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            >
              <PlayCircle className="h-5 w-5" aria-hidden />
              Watch 20s demo
            </Link>
          </div>
          <dl className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {HERO_BENEFITS.map((item) => (
              <div key={item} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                <dt className="font-medium">{item}</dt>
              </div>
            ))}
          </dl>
        </div>
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -left-10 top-8 hidden h-36 w-36 animate-[pulse_5s_ease-in-out_infinite] rounded-full bg-[#fee5f1]/60 blur-3xl lg:block" aria-hidden />
          <div className="absolute -right-8 bottom-10 hidden h-32 w-32 animate-[pulse_7s_ease-in-out_infinite] rounded-full bg-[#dffbe4]/60 blur-3xl lg:block" aria-hidden />
          <div className="relative grid gap-4">
            <div className="group relative overflow-hidden rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur">
              <div className="absolute inset-x-6 top-6 h-20 rounded-2xl bg-gradient-to-tr from-[#fef0ff] via-white to-[#dff5ff] opacity-90 transition duration-700 group-hover:translate-y-1 group-hover:opacity-100" aria-hidden />
              <div className="relative flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  Live profile preview
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground">linket.co/u/you</p>
                  <h2 className="font-display text-2xl text-foreground">Dylan Hart -- Product Designer</h2>
                  <p className="text-sm text-muted-foreground">
                    Portfolio * Calendly * Launch deck * Tap-to-save contact
                  </p>
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    className="flex items-center justify-between rounded-2xl border border-foreground/10 bg-white px-4 py-3 text-left text-sm font-semibold text-foreground shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    Book a meeting
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </button>
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-2xl border border-foreground/10 bg-gradient-to-br from-[#fff8f0] via-white to-[#ffe9f8] p-3 text-sm shadow-sm">
                      <p className="font-semibold text-foreground">Saved to contacts</p>
                      <p className="text-xs text-muted-foreground">vCard updated 2 min ago</p>
                    </div>
                    <div className="flex-1 rounded-2xl border border-foreground/10 bg-gradient-to-br from-[#eff8ff] via-white to-[#dffbe4] p-3 text-sm shadow-sm">
                      <p className="font-semibold text-foreground">Lead captured</p>
                      <p className="text-xs text-muted-foreground">Auto-sync to HubSpot</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-3xl border border-white/60 bg-white/60 p-4 shadow-2xl backdrop-blur">
              {HERO_STATS.map((item) => (
                <div key={item.label} className="rounded-2xl bg-gradient-to-br from-white to-white/60 p-4 text-center shadow-sm">
                  <dt className="text-sm text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1 text-2xl font-semibold text-foreground">{item.value}</dd>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustedBy() {
  return (
    <section aria-label="Trusted by" className="border-y border-foreground/5 bg-white/70">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-10 text-center sm:px-6">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Trusted by students, creators, and modern teams
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-base font-semibold text-muted-foreground/80">
          {SOCIAL_PROOF.map((logo) => (
            <span key={logo} className="tracking-wide">
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function JourneySection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          How Linket flows
        </span>
        <h2 className="mt-5 font-display text-3xl tracking-tight text-foreground sm:text-4xl">
          Meet, share, and stay top-of-mind in one smooth motion
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Linket blends polished hardware with a live profile editor so every introduction feels consistent, warm, and memorable.
        </p>
      </div>
      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {JOURNEY_STEPS.map((step) => (
          <article
            key={step.title}
            className="group relative rounded-3xl border border-foreground/10 bg-white/80 p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            <div
              className={cn(
                "mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm",
                step.accent
              )}
            >
              <step.icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-xl font-semibold text-foreground">{step.title}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{step.description}</p>
            <p className="mt-4 text-sm font-medium text-foreground">{step.detail}</p>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-3xl bg-gradient-to-t from-foreground/[0.02] opacity-0 transition duration-300 group-hover:opacity-100"
              aria-hidden
            />
          </article>
        ))}
      </div>
    </section>
  );
}
function ExperienceSection() {
  return (
    <section id="customization" className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,240,220,0.35),_transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Custom Orders
        </span>
        <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">Work with our sales team on your Linket rollout</h2>
        <p className="mt-4 text-base text-muted-foreground">
          We now route all bespoke hardware and profile setups through our sales specialists. They&apos;ll scope your lineup, share proofs, and coordinate production end-to-end.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          For any custom order, contact sales first so we can tailor materials, timelines, and pricing to your team.
        </p>
        <div className="mt-8 flex justify-center">
          <Button asChild className="rounded-full px-6 py-3">
            <Link href="/contact">Contact sales</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeatureSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            Why Linket
          </span>
          <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
            Built for the moments where intros either land or get forgotten
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Linket pairs premium hardware with software superpowers so you can launch, learn, and iterate without reprinting. Hover each card to see what that means in practice.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {FEATURE_HIGHLIGHTS.map((feature) => (
            <article
              key={feature.title}
              className="group relative overflow-hidden rounded-3xl border border-foreground/10 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <div className={cn("mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl", feature.accent)}>
                <feature.icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{feature.description}</p>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-primary/5 opacity-0 transition duration-300 group-hover:opacity-100"
                aria-hidden
              />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveDemoSection() {
  return (
    <section id="demo" className="relative overflow-hidden border-y border-foreground/5 bg-gradient-to-r from-[#e8faff] via-white to-[#fff1f8] py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.4),_transparent_70%)]" aria-hidden />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-6 lg:flex-row lg:items-center">
        <div className="max-w-lg space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            See it live
          </span>
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">Tap-through demo</h2>
          <p className="text-base text-muted-foreground">
            Scan the QR or click play to explore a Linket profile. You&apos;ll see NFC handoff, hero blocks, lead capture, and real-time analytics come together in under 20 seconds.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1">
              <Waves className="h-4 w-4 text-primary" aria-hidden />
              NFC tap demo
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/60 px-3 py-1">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
              Privacy-first analytics
            </div>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>linket.co/demo</span>
              <span>0:20 walkthrough</span>
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:gap-6">
              <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[26px] border border-foreground/10 bg-gradient-to-br from-[#fdf6ff] via-white to-[#dff5ff] shadow-inner">
                <div className="absolute inset-0 flex flex-col justify-between p-4 text-sm">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 font-semibold text-primary shadow">
                      Hero video
                    </div>
                    <p className="text-lg font-semibold text-foreground">Tap to meet Saira</p>
                    <p className="text-xs text-muted-foreground">Creative Director * @sairamakes</p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <button type="button" className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2 font-semibold text-foreground shadow-sm">
                      View reel
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button type="button" className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2 font-semibold text-foreground shadow-sm">
                      Save contact
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="absolute inset-x-6 bottom-6 h-32 rounded-3xl border border-dashed border-foreground/15 bg-white/70 text-center text-xs text-muted-foreground/80 backdrop-blur">
                  Lead capture form
                  <br />
                  (Name, email, interest)
                </div>
              </div>
              <div className="space-y-4 rounded-3xl border border-foreground/10 bg-white/80 p-5 shadow-inner">
                <h3 className="text-sm font-semibold text-foreground">Snapshot analytics</h3>
                <div className="space-y-3 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#e8f9ff] to-transparent px-3 py-2">
                    <span>Taps today</span>
                    <span className="font-semibold text-foreground">134</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#fff0f7] to-transparent px-3 py-2">
                    <span>Saved contacts</span>
                    <span className="font-semibold text-foreground">89</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#edfdf4] to-transparent px-3 py-2">
                    <span>Top link</span>
                    <span className="font-semibold text-foreground">Shop collection</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-dashed border-foreground/15 bg-white/60 p-4 text-xs text-muted-foreground">
                  Scan the QR or tap a Linket to experience this flow on your phone.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
function UseCasesSection() {
  return (
    <section id="teams" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Use cases
        </span>
        <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
          Linket adapts to every introduction -- campus, stage, or sales floor
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Switch between presets to match your audience. Linket remembers the links, colors, and form fields that deliver the best follow-through.
        </p>
      </div>
      <Tabs defaultValue={USE_CASES[0]?.slug} className="mt-12">
        <TabsList className="mx-auto flex w-full flex-wrap justify-center gap-2 bg-transparent p-0">
          {USE_CASES.map((useCase) => (
            <TabsTrigger
              key={useCase.slug}
              value={useCase.slug}
              className="rounded-full border border-transparent px-4 py-2 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              {useCase.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {USE_CASES.map((useCase) => (
          <TabsContent key={useCase.slug} value={useCase.slug} className="mt-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <article className="rounded-3xl border border-foreground/10 bg-white/80 p-8 shadow-sm">
                <span className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">{useCase.eyebrow}</span>
                <h3 className="mt-3 text-2xl font-semibold text-foreground">{useCase.title}</h3>
                <p className="mt-4 text-sm text-muted-foreground">{useCase.body}</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {useCase.highlights.map((highlight) => (
                    <span key={highlight} className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                      {highlight}
                    </span>
                  ))}
                </div>
              </article>
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-[28px] bg-gradient-to-br opacity-40 blur-2xl"
                  style={{ backgroundImage: `linear-gradient(135deg, ${useCase.gradient})` }}
                  aria-hidden
                />
                <div className="relative overflow-hidden rounded-[28px] border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur">
                  <div className="text-sm font-semibold text-muted-foreground">Preset preview</div>
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-white to-white/60 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground/70">Hero headline</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">Tap to see the {useCase.title.toLowerCase()} flow</p>
                    </div>
                    <div className="rounded-2xl border border-dashed border-foreground/15 bg-white/60 p-4 text-xs text-muted-foreground">
                      Lead form blocks go here: name, email, and a custom qualifier unique to this preset.
                    </div>
                    <div className="flex gap-3">
                      <button type="button" className="flex-1 rounded-2xl border border-foreground/15 bg-white px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                        Share preset
                      </button>
                      <button type="button" className="flex-1 rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 px-4 py-3 text-sm font-semibold text-primary-foreground shadow transition hover:shadow-lg">
                        Activate profile
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden border-y border-foreground/5 bg-gradient-to-br from-[#111827]/95 via-[#111827] to-[#1f2937] py-24 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_65%)]" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
            Proof in motion
          </span>
          <h2 className="mt-4 font-display text-3xl tracking-tight text-white sm:text-4xl">
            Linket keeps intros warm long after the tap
          </h2>
          <p className="mt-4 text-base text-white/70">
            Teams, collectives, and campuses use Linket to make sure their message actually lands. Here&apos;s what happens when they do.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <article key={testimonial.name} className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/20">
              <p className="text-base leading-relaxed text-white/90">&quot;{testimonial.quote}&quot;</p>
              <div className="mt-8 border-t border-white/10 pt-5 text-sm text-white/80">
                <p className="font-semibold text-white">{testimonial.name}</p>
                <p>{testimonial.role}</p>
                <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {testimonial.result}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function PricingSection() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Pricing
        </span>
        <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">Tap-ready Linkets for any size launch</h2>
        <p className="mt-4 text-base text-muted-foreground">
          Start with one, upgrade to custom finishes, or roll out to your entire team. Every plan includes live editing, analytics, and support.
        </p>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PRICING_PLANS.map((plan) => (
          <article
            key={plan.name}
            className={cn(
              "relative rounded-3xl border border-foreground/10 bg-white/80 p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl",
              plan.featured && "border-primary/40 bg-gradient-to-br from-[#f9fbff] via-white to-[#e8f7ff]"
            )}
          >
            {plan.featured && (
              <span className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Most loved
              </span>
            )}
            <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.cadence}</span>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={plan.featured ? "default" : "outline"}
              className={cn("mt-8 w-full rounded-full", !plan.featured && "border-foreground/20")}
            >
              <Link href={plan.href}>{plan.cta}</Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function FAQSection() {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 py-24 sm:px-6">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          FAQ
        </span>
        <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">Answers before you tap</h2>
        <p className="mt-4 text-base text-muted-foreground">
          Everything you need to know about Linket hardware, profiles, and data.
        </p>
      </div>
      <Accordion type="single" collapsible className="mt-10 space-y-4">
        {FAQ.map((item, index) => (
          <AccordionItem key={item.question} value={`faq-${index}`} className="overflow-hidden rounded-3xl border border-foreground/10 bg-white/80 px-5">
            <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function FinalCTASection() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent" aria-hidden />
      <div className="relative mx-auto max-w-4xl rounded-[36px] border border-white/60 bg-white/80 px-6 py-16 text-center shadow-2xl backdrop-blur sm:px-10">
        <Image
          src={brand.logo}
          alt={`${brand.name} logo`}
          width={180}
          height={60}
          className="mx-auto h-12 w-auto"
        />
        <h2 className="mt-6 font-display text-3xl tracking-tight sm:text-4xl">
          Ready to launch a Linket that people remember?
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Build your hardware, craft your profile, and start sharing in less than a week. Let&apos;s make every tap count.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="rounded-full px-6 py-3">
            <Link href="/customize">Create my Linket</Link>
          </Button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-foreground/30 hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
          >
            Explore the dashboard
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}



