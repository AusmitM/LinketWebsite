import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import type { LucideIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Calendar,
  Download,
  Focus,
  Instagram,
  LineChart,
  Pencil,
  UserRound,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Twitter,
  Waves,
  Youtube,
} from "lucide-react";
import { CreativePricing } from "@/components/ui/creative-pricing";
import type { PricingTier } from "@/components/ui/creative-pricing";
import { FeatureSteps } from "@/components/ui/feature-section";
import { TestimonialSlider } from "@/components/ui/testimonial-slider";
import { LiveDemoWorkspaceCard } from "@/components/landing/live-demo-workspace-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Linket Connect",
  description:
    "Linket keychains share your digital profile with a single tap. Customize the hardware, control every link, and see analytics from the very first introduction.",
  openGraph: {
    title: "Linket -- Stay Connected",
    description:
      "From the first tap to saved contact, Linket keeps intros warm. NFC + QR hardware, live editing, and analytics built for students, creators, and teams.",
    images: [
      {
        url: "/og.png",
        width: 120,
        height: 120,
        alt: "Linket logo mark.",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Stay Connected",
    description:
      "Linket is the customizable tap-to-share keychain that keeps your information current with every scan.",
    images: ["/og.png"],
  },
};

const SOCIAL_PROOF = [
  "AAcuisine",
  "Houston Bee Rescue",
  "East Bay Robotics",
  "Sunset Creative",
  "Brimstone Events",
] as const;

const DASHBOARD_TABS = ["Overview", "Linkets", "Profiles", "Leads"] as const;

const DASHBOARD_VIEWS = ["Overview", "Linkets", "Profiles", "Leads"] as const;

const DASHBOARD_STATS = [
  { label: "Leads collected", value: "128", delta: "+32 vs last quarter" },
  { label: "Scans", value: "842", delta: "+19% vs last quarter" },
  {
    label: "Conversion rate",
    value: "15.2%",
    delta: "Leads ÷ scans in this range",
  },
  {
    label: "Active Linkets",
    value: "7",
    delta: "Linkets that got at least one scan",
  },
] as const;

const DASHBOARD_BARS = [
  { label: "Jan", value: 72 },
  { label: "Feb", value: 35 },
  { label: "Mar", value: 58 },
  { label: "Apr", value: 82 },
  { label: "May", value: 22 },
  { label: "Jun", value: 48 },
  { label: "Jul", value: 64 },
  { label: "Aug", value: 38 },
  { label: "Sep", value: 52 },
  { label: "Oct", value: 44 },
  { label: "Nov", value: 70 },
  { label: "Dec", value: 86 },
] as const;

const DASHBOARD_TREND = [
  28, 34, 39, 46, 53, 61, 69, 76, 82, 88, 94, 98,
] as const;

const RECENT_SALES = [
  { name: "Olivia Martin", email: "olivia.martin@email.com", amount: "New" },
  { name: "Jackson Lee", email: "jackson.lee@email.com", amount: "Yesterday" },
  {
    name: "Isabella Nguyen",
    email: "isabella.nguyen@email.com",
    amount: "3 days ago",
  },
  { name: "William Kim", email: "will.kim@email.com", amount: "Followed up" },
  { name: "Sofia Davis", email: "sofia.davis@email.com", amount: "1 week ago" },
] as const;

const FOOTER_LINK_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#demo" },
      { label: "Pricing", href: "#pricing" },
      { label: "Hardware", href: "/customize" },
      { label: "Templates", href: "#teams" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Blog", href: "/blog" },
      { label: "Press", href: "/press" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "/support" },
      { label: "Status", href: "/status" },
      { label: "Contact", href: "/contact" },
      { label: "Docs", href: "/docs" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
] as const;

const FOOTER_SOCIALS = [
  { label: "Twitter", href: "https://twitter.com/linket", icon: Twitter },
  { label: "Instagram", href: "https://instagram.com/linket", icon: Instagram },
  { label: "YouTube", href: "https://youtube.com/@linket", icon: Youtube },
] as const;

const PRICING_TIERS: PricingTier[] = [
  {
    name: "Field Starter",
    icon: <Pencil className="h-6 w-6" />,
    price: 39,
    description: "Equip solo sellers with tap-to-share kits.",
    color: "amber",
    features: [
      "1 Linket hardware kit",
      "Live profile editor",
      "Tap + QR analytics",
      "Email support",
    ],
  },
  {
    name: "Team Builder",
    icon: <Star className="h-6 w-6" />,
    price: 119,
    description: "Most popular plan for pods and clubs.",
    color: "blue",
    features: [
      "Up to 10 kits",
      "Brand-safe templates",
      "Collab dashboard",
      "Priority onboarding",
    ],
    popular: true,
  },
  {
    name: "Enterprise Studio",
    icon: <Sparkles className="h-6 w-6" />,
    price: 279,
    description: "Roll Linket across campuses or field teams.",
    color: "purple",
    features: [
      "Unlimited kits",
      "CRM + webhook exports",
      "Dedicated strategist",
      "Custom hardware runs",
    ],
  },
];

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
    description:
      "Your hero links, galleries, and saved contact card appear at once.",
    detail:
      "Decide which blocks lead and guide every viewer to the next action.",
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

const JOURNEY_FEATURES = [
  {
    step: "Step 1",
    title: JOURNEY_STEPS[0].title,
    content: `${JOURNEY_STEPS[0].description} ${JOURNEY_STEPS[0].detail}`,
    image:
      "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=1600&q=80",
  },
  {
    step: "Step 2",
    title: JOURNEY_STEPS[1].title,
    content: `${JOURNEY_STEPS[1].description} ${JOURNEY_STEPS[1].detail}`,
    image:
      "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    step: "Step 3",
    title: JOURNEY_STEPS[2].title,
    content: `${JOURNEY_STEPS[2].description} ${JOURNEY_STEPS[2].detail}`,
    image:
      "https://images.unsplash.com/photo-1485217988980-11786ced9454?auto=format&fit=crop&w=1600&q=80",
  },
] as const;

type Testimonial = {
  quote: string;
  name: string;
  role: string;
  result: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Every student left our career fair with Linket saved in their contacts. We saw a 4x increase in follow-up meetings.",
    name: "Jamila Reyes",
    role: "Director of Partnerships, CampusLoop",
    result: "4x follow-up rate",
  },
  {
    quote:
      "Linket lets our pop-up teams capture leads without juggling tablets. We close same-day sales because the info sticks.",
    name: "Evan Blake",
    role: "Retail Ops, Sundrift",
    result: "+63% qualified leads",
  },
  {
    quote:
      "The ability to push a new menu to every Linket overnight is the superpower our food truck collective needed.",
    name: "Mina Chen",
    role: "Founder, Night Market Co.",
    result: "Menu swaps in minutes",
  },
];

const SLIDER_TESTIMONIALS = [
  {
    id: 1,
    quote: TESTIMONIALS[0].quote,
    name: TESTIMONIALS[0].name,
    username: TESTIMONIALS[0].role,
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 2,
    quote: TESTIMONIALS[1].quote,
    name: TESTIMONIALS[1].name,
    username: TESTIMONIALS[1].role,
    avatar:
      "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=600&q=80",
  },
  {
    id: 3,
    quote: TESTIMONIALS[2].quote,
    name: TESTIMONIALS[2].name,
    username: TESTIMONIALS[2].role,
    avatar:
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80",
  },
] as const;

const FAQ = [
  {
    question: "Does Linket work with both iPhone and Android?",
    answer:
      "Yes. Modern phones tap via NFC and older devices can scan the etched QR. No downloads needed for either option.",
  },
  {
    question: "Do recipients need a Linket or an app?",
    answer:
      "No. Your Linket opens in the recipient&apos;s browser right away. They can save your contact, follow links, or book time instantly.",
  },
  {
    question: "Can I update my profile after printing?",
    answer:
      "Absolutely. Change your headline, links, colors, or media anytime. Every tap uses the latest version automatically.",
  },
  {
    question: "How fast do orders ship?",
    answer:
      "Single Linkets ship within 48 hours. Team and event kits include a dedicated concierge for rush coordination.",
  },
  {
    question: "Is data collection privacy-centered?",
    answer:
      "We only track what matters: tap counts, link clicks, and lead form submissions. No invasive tracking or retargeting pixels.",
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
    <div className="relative overflow-hidden bg-[#fff7ed] text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#fff5e1] via-[#ffe4d6] to-[#cfe8ff]" />
        <div className="absolute left-1/2 -top-32 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,161,135,0.35),_rgba(255,245,225,0))] blur-3xl" />
        <div className="absolute right-0 top-32 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,_rgba(255,221,173,0.3),_rgba(255,247,236,0))] blur-3xl" />
        <div className="absolute inset-x-0 bottom-[-30%] h-[600px] bg-[radial-gradient(circle_at_bottom,_rgba(94,211,243,0.35),_rgba(207,232,255,0))]" />
      </div>
      <HeroSection />
      <TrustedBy />
      <JourneySection />
      <ExperienceSection />
      <LiveDemoSection />
      <TestimonialsSection />
      <PricingSection />
      <FAQSection />
      <LandingFooter />
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
    <section
      id="hero"
      className="relative isolate overflow-hidden text-slate-900"
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/3 -top-16 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,_rgba(255,176,139,0.35),_rgba(255,247,234,0))] blur-3xl" />
        <div className="absolute right-16 top-20 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(125,211,252,0.25),_rgba(255,255,255,0))] blur-3xl" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 pb-24 pt-8 text-center sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl py-12">
          <h1 className="mt-10 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-[4.5rem] lg:leading-[1.1]">
            Don&apos;t just share it...{" "}
            <span className="block text-8xl font-black italic tracking-tight sm:text-8xl lg:text-[5.25rem] bg-[linear-gradient(100deg,_#ff9776_0%,_#ffd27f_40%,_#7dd3fc_70%,_#2f80ed_100%)] bg-clip-text text-transparent">
              LINKET!
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 sm:text-lg">
            Transform your market into leads, and your leads into sales with our comprehensive suite of
            development tools and resources. Launch faster, adapt in real time,
            and keep every interaction memorable.
          </p>
          <div className="mt-10 flex justify-center">
            <Button
              asChild
              size="lg"
              className="rounded-full bg-gradient-to-r from-[#ff9776] via-[#ffb866] to-[#5dd6f7] px-10 py-6 text-base font-semibold text-white shadow-[0_20px_50px_rgba(255,151,118,0.35)]"
            >
              <Link href="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
        <HeroDashboardPreview />
      </div>
    </section>
  );
}

function HeroDashboardPreview() {
  const trendPoints = DASHBOARD_TREND.map((value, index) => {
    const x = 10 + (index / (DASHBOARD_TREND.length - 1)) * 300;
    const y = 92 - (value / 100) * 70;
    return { x, y };
  });
  const trendPath = `M ${trendPoints
    .map((point) => `${point.x} ${point.y}`)
    .join(" L ")}`;
  const trendArea = `${trendPath} L ${
    trendPoints[trendPoints.length - 1].x
  } 110 L ${trendPoints[0].x} 110 Z`;

  return (
    <div className="relative w-full max-w-6xl rounded-[32px] border border-[#f5d7b0]/80 bg-white/85 p-6 text-left text-slate-900 shadow-[0_45px_120px_rgba(254,215,170,0.45)] backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-orange-100 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 rounded-full border border-[#ffd4c2] bg-[#fff6ef] px-4 py-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ff9776] to-[#ffd27f] text-sm font-semibold text-white">
            AK
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Operator
            </p>
            <p className="font-semibold text-slate-900">Alicia Koch</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-3 lg:flex-1 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {DASHBOARD_TABS.map((tab, index) => (
              <span
                key={tab}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition",
                  index === 0
                    ? "border-[#ff9776] bg-[#ff9776] text-white"
                    : "border-slate-200 text-slate-500"
                )}
              >
                {tab}
              </span>
            ))}
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="relative w-full max-w-xs flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300"
                aria-hidden
              />
              <input
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-11 pr-4 text-sm text-slate-700 placeholder:text-slate-300 focus:border-[#ff9776] focus:outline-none focus:ring-2 focus:ring-[#ff9776]/30"
                placeholder="Search..."
              />
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 sm:flex">
              <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
              <span>Jan 20, 2023 - Feb 09, 2023</span>
            </div>
            <button className="hidden items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white sm:inline-flex">
              <Download className="h-4 w-4" aria-hidden />
              Download
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white">
              <UserRound className="h-5 w-5 text-slate-700" aria-hidden />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="text-3xl font-semibold text-slate-900">Dashboard</h3>
          <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
            {DASHBOARD_VIEWS.map((view, index) => (
              <span
                key={view}
                className={cn(
                  "rounded-full border px-3 py-1",
                  index === 0
                    ? "border-[#7dd3fc] bg-[#7dd3fc]/20 text-[#0f172a]"
                    : "border-slate-200 text-slate-400"
                )}
              >
                {view}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {DASHBOARD_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-[#fff9f3] p-4"
            >
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                {stat.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {stat.value}
              </p>
              <p className="text-xs text-emerald-500">{stat.delta}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-[#fff7ef] p-6">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.75),_rgba(255,247,239,0)_60%)]"
              aria-hidden
            />
            <div className="relative space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    Scans and leads over time
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.35em] text-slate-400">
                    Activity pulse
                  </p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-1">
                <div className="flex min-h-[320px] flex-col rounded-2xl border border-slate-100 bg-white/90 p-5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="uppercase tracking-[0.35em]">
                      Scans trend
                    </span>
                    <span className="font-semibold text-slate-500">
                      Last 12 months
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 320 120"
                    className="mt-4 h-56 w-full flex-1"
                    aria-hidden
                  >
                    <defs>
                      <linearGradient
                        id="scan-trend-line"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#ffb27a" />
                        <stop offset="55%" stopColor="#ffd6a3" />
                        <stop offset="100%" stopColor="#7dd3fc" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 24 H320 M0 52 H320 M0 80 H320"
                      stroke="#e8eef6"
                      strokeWidth="1"
                      strokeDasharray="4 6"
                      fill="none"
                    />
                    <path
                      d={trendArea}
                      fill="url(#scan-trend-line)"
                      opacity="0.16"
                    />
                    <path
                      d={trendPath}
                      fill="none"
                      stroke="url(#scan-trend-line)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx={trendPoints[trendPoints.length - 1].x}
                      cy={trendPoints[trendPoints.length - 1].y}
                      r="5"
                      fill="#22c55e"
                    />
                  </svg>
                  <div className="mt-3 grid grid-cols-6 gap-2 text-[11px] uppercase tracking-[0.25em] text-slate-300 sm:grid-cols-12">
                    {DASHBOARD_BARS.map((bar) => (
                      <span key={bar.label} className="text-center">
                        {bar.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="text-lg font-semibold text-slate-900">Recent leads</p>
            <p className="text-xs text-slate-500">
              You made {RECENT_SALES.length} new connections this period.
            </p>
            <div className="mt-6 space-y-4">
              {RECENT_SALES.map((sale) => {
                const initials = sale.name
                  .split(" ")
                  .map((segment) => segment[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={sale.email}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff1db] text-sm font-semibold text-slate-800">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {sale.name}
                        </p>
                        <p className="text-xs text-slate-500">{sale.email}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-emerald-500">
                      {sale.amount}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustedBy() {
  return (
    <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-foreground/10 bg-white/80 p-6 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Trusted By
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Sales pods, university teams, and creators keep Linket on their
          keychains to turn every intro into a saved contact.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-foreground/80 sm:gap-3 sm:text-sm">
          {SOCIAL_PROOF.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-2 rounded-full border border-foreground/10 px-3 py-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function JourneySection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <FeatureSteps
        className="mt-8 rounded-[36px] border border-foreground/5 bg-white/90 shadow-[0_35px_80px_rgba(15,23,42,0.08)]"
        features={JOURNEY_FEATURES}
        title="How Linket flows"
        autoPlayInterval={4000}
        imageHeight="lg:h-[420px]"
      />
    </section>
  );
}

function ExperienceSection() {
  return (
    <section
      id="customization"
      className="relative overflow-hidden bg-[#050816] py-24 text-white"
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(77,121,255,0.25),_rgba(5,8,22,0))]"
        aria-hidden
      />
      <div
        className="absolute inset-y-0 right-[-10%] h-[480px] w-[480px] rounded-full bg-[radial-gradient(circle,_rgba(255,151,118,0.25),_rgba(5,8,22,0))] blur-[160px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#050816] via-[#0a0f1e]/30 to-transparent"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 sm:px-6 lg:flex-row lg:items-center">
        <div className="space-y-6 lg:w-3/5">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-white/60">
            Custom orders
          </p>
          <div>
            <p className="text-3xl font-semibold sm:text-4xl">
              <span className="text-white/80">
                Generate, tweak, and deploy Linket hardware{" "}
              </span>
              <span className="bg-gradient-to-r from-[#ff9776] via-[#ffd27f] to-[#7dd3fc] bg-clip-text text-transparent">
                10x faster
              </span>
            </p>
            <p className="mt-4 text-base text-white/70">
              Work directly with our hardware strategists to choose finishes,
              engraving, and fulfillment flows that match your brand. We handle
              proofs, sourcing, and rollout so you can stay focused on demos.
            </p>
          </div>
          <div className="grid gap-4 text-sm text-white/80 sm:grid-cols-2">
            {[
              "Premium metals, wood, and eco-resin options",
              "Custom engravings + Pantone-matched finishes",
              "Bulk activation + profile templates",
              "Lead routing, CRM exports, and analytics",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_80px_rgba(5,5,20,0.45)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9776] via-[#ffb866] to-[#5dd6f7] text-slate-900">
              <Sparkles className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-lg font-semibold text-white">Get in touch</p>
              <p className="text-xs text-white/60">
                Unlock the full Linket experience with our custom team.
              </p>
            </div>
          </div>
          <form className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="custom-email"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
              >
                Work email
              </label>
              <input
                id="custom-email"
                type="email"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#ff9776] focus:outline-none focus:ring-2 focus:ring-[#ff9776]/40"
                placeholder="name@company.com"
              />
            </div>
            <div>
              <label
                htmlFor="custom-team"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
              >
                Team size
              </label>
              <input
                id="custom-team"
                type="text"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#5dd6f7] focus:outline-none focus:ring-2 focus:ring-[#5dd6f7]/40"
                placeholder="e.g. 25 reps"
              />
            </div>
            <div>
              <label
                htmlFor="custom-notes"
                className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
              >
                Notes
              </label>
              <textarea
                id="custom-notes"
                rows={3}
                className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#ff9776] focus:outline-none focus:ring-2 focus:ring-[#ff9776]/40"
                placeholder="Share timelines or hardware goals..."
              />
            </div>
            <Button className="w-full rounded-2xl bg-gradient-to-r from-[#ff9776] via-[#ffb866] to-[#5dd6f7] text-base font-semibold text-slate-900 shadow-[0_15px_45px_rgba(255,151,118,0.35)]">
              Book your consult
            </Button>
            <p className="text-center text-xs text-white/50">
              We reply within one business day.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

function LiveDemoSection() {
  return (
    <section id="demo" className="relative overflow-hidden py-24">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.4),_transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 sm:px-6 lg:flex-row lg:items-center">
        <div className="max-w-lg space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            See it live
          </span>
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            Tap-through demo
          </h2>
          <p className="text-base text-muted-foreground">
            Scan the QR or click play to explore a Linket profile. You&apos;ll
            see NFC handoff, hero blocks, lead capture, and real-time analytics
            come together in under 20 seconds.
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
          <div
            className="absolute inset-0 rounded-[40px] bg-gradient-to-br from-primary/20 via-transparent to-transparent blur-3xl"
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/85 p-6 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>linket.co/demo</span>
              <span>0:20 walkthrough</span>
            </div>
            <LiveDemoWorkspaceCard />
          </div>
        </div>
      </div>
    </section>
  );
}
function TestimonialsSection() {
  return (
    <section className="relative -mt-12 overflow-hidden pb-24 pt-32 text-[#0f172a]">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.4),_transparent_70%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <TestimonialSlider
          testimonials={SLIDER_TESTIMONIALS}
          eyebrow="Proof in motion"
          title="Linket keeps intros warm long after the tap"
          tone="light"
          className="shadow-[0_45px_120px_rgba(255,151,118,0.25)]"
        />
      </div>
    </section>
  );
}
function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6"
    >
      <CreativePricing
        tag="Linket plans"
        title="The tap-to-share stack for every crew"
        description="Choose the plan that keeps every intro warm—from solo sellers to nationwide teams."
        tiers={PRICING_TIERS}
      />
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
        <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
          Answers before you tap
        </h2>
        <p className="mt-4 text-base text-muted-foreground">
          Everything you need to know about Linket hardware, profiles, and data.
        </p>
      </div>
      <Accordion type="single" collapsible className="mt-10 space-y-4">
        {FAQ.map((item, index) => (
          <AccordionItem
            key={item.question}
            value={`faq-${index}`}
            className="overflow-hidden rounded-3xl border border-foreground/10 bg-white/80 px-5"
          >
            <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function LandingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-white/40 bg-[#050816] text-white">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_rgba(5,8,22,0))]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <div className="flex items-center gap-3 text-lg font-semibold">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <span className="text-2xl">🔗</span>
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-white/70">
                  {brand.name}
                </p>
                <p className="text-2xl font-bold text-white">
                  Tap once. Stay remembered.
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm text-white/70">
              Linket turns every tap into a live microsite, lead capture, and
              follow-up customers actually remember. Built for students,
              creators, and field teams who want intros that stick.
            </p>
            <div className="mt-6 space-y-2 text-sm text-white/70">
              <p className="text-white/80">punit@peridotkonda.com</p>
              <p className="text-white/60">
                 400 Bizzell St, College Station, TX
              </p>
            </div>
            <div className="mt-8 flex items-center gap-4">
              {FOOTER_SOCIALS.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/70 transition hover:-translate-y-1 hover:text-white"
                >
                  <social.icon className="h-5 w-5" aria-hidden />
                </Link>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm text-white/70 sm:grid-cols-4">
            {FOOTER_LINK_GROUPS.map((group) => (
              <div key={group.title} className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">
                  {group.title}
                </p>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="transition hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} {brand.name}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/security" className="transition hover:text-white">
              Security
            </Link>
            <Link
              href="mailto:hello@linket.com"
              className="transition hover:text-white"
            >
              Contact sales
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
