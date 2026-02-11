import type { Metadata } from "next";

import { LEGAL_PAGE_ACTIONS } from "@/components/site/legal-page-actions";
import { MarketingPage, PageSection } from "@/components/site/marketing-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "Linket Connect terms of service and usage guidelines.",
};

const TERMS = [
  {
    title: "Account responsibilities",
    points: [
      "Keep login credentials secure and up to date.",
      "Use Linket profiles for lawful, professional interactions.",
    ],
  },
  {
    title: "Acceptable use",
    points: [
      "Do not upload harmful or misleading content.",
      "Respect privacy and consent when collecting leads.",
    ],
  },
  {
    title: "Service availability",
    points: [
      "We strive for high uptime and notify customers of planned maintenance.",
      "Status updates are available on the status page.",
    ],
  },
];

export default function TermsPage() {
  return (
    <MarketingPage
      kicker="Legal"
      title="Terms of service"
      subtitle="Clear expectations for using Linket hardware, profiles, and analytics."
      actions={LEGAL_PAGE_ACTIONS}
    >
      {TERMS.map((section) => (
        <PageSection key={section.title} title={section.title}>
          <ul className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
            {section.points.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PageSection>
      ))}
      <PageSection title="Questions">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          Email legal@linketconnect.com for questions about these terms.
        </div>
      </PageSection>
    </MarketingPage>
  );
}
