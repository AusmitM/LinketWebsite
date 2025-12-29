export const LANDING_LINKS = [
  {
    id: "how-it-works",
    label: "How it Works",
    gradient: "linear-gradient(120deg,#ff9776 0%,#ffb166 100%)",
    shadow: "0 10px 24px rgba(255,151,118,0.35)",
  },
  {
    id: "customization",
    label: "Customization",
    gradient: "linear-gradient(120deg,#ffb166 0%,#ffd27f 100%)",
    shadow: "0 10px 24px rgba(255,183,120,0.32)",
  },
  {
    id: "demo",
    label: "Demo",
    gradient: "linear-gradient(120deg,#ffd27f 0%,#ffc3a0 100%)",
    shadow: "0 10px 24px rgba(255,178,140,0.28)",
  },
  {
    id: "pricing",
    label: "Pricing",
    gradient: "linear-gradient(120deg,#ffc3a0 0%,#ff9fb7 100%)",
    shadow: "0 10px 24px rgba(255,159,183,0.28)",
  },
  {
    id: "faq",
    label: "FAQ",
    gradient: "linear-gradient(120deg,#ff9fb7 0%,#7fc8e8 100%)",
    shadow: "0 10px 24px rgba(127,200,232,0.3)",
  },
] as const;

export type LandingSectionId = (typeof LANDING_LINKS)[number]["id"];
