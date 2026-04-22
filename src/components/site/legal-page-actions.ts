export const LEGAL_PAGE_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Security", href: "/security" },
  { label: "Accessibility", href: "/accessibility" },
  { label: "Warranty", href: "/warranty" },
] as const;

export const LEGAL_PAGE_ACTIONS = [
  { label: "Back to landing", href: "/", variant: "default" },
  ...LEGAL_PAGE_LINKS.map((link) => ({ ...link, variant: "outline" as const })),
] as const;
