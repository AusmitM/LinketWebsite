export type DiscoverPageHref =
  | "/digital-business-card"
  | "/nfc-business-card"
  | "/link-in-bio";

export type DiscoverPage = {
  href: DiscoverPageHref;
  label: string;
  navLabel: string;
  cardDescription: string;
  metaTitle: string;
  metaDescription: string;
};

export const DISCOVER_PAGES: readonly DiscoverPage[] = [
  {
    href: "/digital-business-card",
    label: "Digital business card",
    navLabel: "Digital Card",
    cardDescription:
      "Compare paper cards, QR cards, and live digital profiles for modern contact sharing.",
    metaTitle: "Digital business card | Linket Connect",
    metaDescription:
      "Linket Connect is a digital business card platform with NFC + QR sharing, live profile updates, contact saving, lead capture, and analytics.",
  },
  {
    href: "/nfc-business-card",
    label: "NFC business card",
    navLabel: "NFC Card",
    cardDescription:
      "See how tap-to-share hardware works with QR fallback, live profiles, and contact saving.",
    metaTitle: "NFC business card | Linket Connect",
    metaDescription:
      "Linket Connect pairs NFC tap-to-share hardware with QR fallback, live digital profiles, contact saving, and built-in lead capture.",
  },
  {
    href: "/link-in-bio",
    label: "Link in bio",
    navLabel: "Link in Bio",
    cardDescription:
      "A creator-friendly bio page that also works in person through NFC and QR sharing.",
    metaTitle: "Link in bio | Linket Connect",
    metaDescription:
      "Linket Connect gives creators and small teams a link in bio page with live updates, contact saving, lead capture, and NFC + QR sharing.",
  },
] as const;

export function getDiscoverPage(href: DiscoverPageHref) {
  const page = DISCOVER_PAGES.find((entry) => entry.href === href);
  if (!page) {
    throw new Error(`Unknown discover page: ${href}`);
  }
  return page;
}
