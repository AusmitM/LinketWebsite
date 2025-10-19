export type Story = {
  slug: string;
  title: string;
  summary: string;
  badge: string;
  stat: string;
  image: string;
  heroTitle: string;
  heroDescription: string;
  quote: { text: string; author: string; role: string };
  highlights: Array<{ title: string; description: string }>;
  metrics: Array<{ label: string; value: string }>;
  actions: Array<{ label: string; href: string; variant?: "primary" | "secondary" }>;
};

export const STORIES: Story[] = [
  {
    slug: "students",
    title: "Cal Poly career fair",
    summary: "Linkets helped Maya's team swap paper resumes for tappable profiles and land 9 follow-up calls.",
    badge: "Students",
    stat: "9 callbacks in 2 days",
    image: "/mockups/keychain.svg",
    heroTitle: "Maya turned handshakes into interview invites",
    heroDescription:
      "With Linket, Maya's student org shared polished digital profiles, project portfolios, and a call-to-action to book follow-ups right on the spot.",
    quote: {
      text: "Recruiters kept asking how we built it—so we just tapped our Linkets again and sent them the template. Easy win.",
      author: "Maya H.",
      role: "Design engineer, Cal Poly",
    },
    highlights: [
      { title: "30-second setup", description: "Preloaded brand colors and resume sections matched every member." },
      { title: "Follow-up ready", description: "Tap captured recruiter emails into a shared Notion table." },
      { title: "Reusable every fair", description: "Switch portfolio links before each event—no reprints needed." },
    ],
    metrics: [
      { label: "Callbacks", value: "9" },
      { label: "Profiles shared", value: "120" },
      { label: "Setup time", value: "18 min" },
    ],
    actions: [
      { label: "Launch student preview", href: "/customize?preset=student", variant: "primary" },
      { label: "Share with your org", href: "/pricing#student", variant: "secondary" },
    ],
  },
  {
    slug: "creators",
    title: "Creator pop-up shop",
    summary: "Leo converted 38% more shoppers by letting them tap for his portfolio + Shopify checkout on-site.",
    badge: "Creators",
    stat: "+38% conversions",
    image: "/mockups/phone.svg",
    heroTitle: "Leo turned curious shoppers into loyal clients",
    heroDescription:
      "At a weekend pop-up, Leo's Linket let fans follow his socials, shop limited drops, and schedule mini shoots without scanning a QR.",
    quote: {
      text: "The tap felt premium—people told me it matched my brand. And yes, sales jumped.",
      author: "Leo R.",
      role: "Creative director & photographer",
    },
    highlights: [
      { title: "Instant socials", description: "IG, TikTok, and newsletter preloaded with tracking parameters." },
      { title: "Drop-ready", description: "Shopify cart link auto-applied pop-up promo codes." },
      { title: "Booking flow", description: "Clients booked 12 mini sessions via Calendly on the spot." },
    ],
    metrics: [
      { label: "Conversion lift", value: "38%" },
      { label: "Average tap dwell", value: "54s" },
      { label: "Mini sessions booked", value: "12" },
    ],
    actions: [
      { label: "Use creator template", href: "/customize?preset=creator", variant: "primary" },
      { label: "See creator pricing", href: "/pricing#creator", variant: "secondary" },
    ],
  },
  {
    slug: "hospitality",
    title: "Coastal Coffee loyalty",
    summary: "Hospitality staff share menus, Wi-Fi, and tipping flows with one tap—no QR codes peeling off.",
    badge: "Hospitality",
    stat: "2.4x repeat visits",
    image: "/mockups/keychain.svg",
    heroTitle: "Coastal Coffee replaced QR codes with Linket",
    heroDescription:
      "Guests tap the barista's Linket to pull up seasonal drinks, join the loyalty list, and leave a tip—no sticky codes, no reprints.",
    quote: {
      text: "We stopped reprinting QR menus. Staff love it, guests rave about the little tap moment.",
      author: "Nina K.",
      role: "Founder, Coastal Coffee",
    },
    highlights: [
      { title: "In-shift swap", description: "Managers swap specials and Wi-Fi instantly via dashboard." },
      { title: "Loyalty lift", description: "38% of taps joined SMS rewards in the first week." },
      { title: "Easy to sanitize", description: "Keychains wipe clean—no stickers peeling from steam." },
    ],
    metrics: [
      { label: "Repeat visits", value: "2.4x" },
      { label: "SMS opt-in", value: "38%" },
      { label: "Setup time", value: "22 min" },
    ],
    actions: [
      { label: "Plan hospitality rollout", href: "/contact?topic=hospitality", variant: "primary" },
      { label: "Explore team pricing", href: "/pricing#business", variant: "secondary" },
    ],
  },
];

export function getStory(slug: string): Story | undefined {
  return STORIES.find((story) => story.slug === slug);
}

