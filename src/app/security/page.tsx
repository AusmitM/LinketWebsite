import type { Metadata } from "next";

import { LEGAL_PAGE_ACTIONS } from "@/components/site/legal-page-actions";
import { MarketingPage, PageSection } from "@/components/site/marketing-page";

export const metadata: Metadata = {
  title: "Security",
  description: "Linket Connect security practices and data protection details.",
};

const SECURITY_PRACTICES = [
  "Encrypted data in transit and at rest",
  "Role-based access for team dashboards",
  "Regular vulnerability scanning",
  "Audit trails for profile changes",
  "Secure NFC + QR routing",
];

export default function SecurityPage() {
  return (
    <MarketingPage
      kicker="Legal"
      title="Security at Linket"
      subtitle="We protect every tap, scan, and lead captured through Linket."
      actions={LEGAL_PAGE_ACTIONS}
    >
      <PageSection title="Security practices" subtitle="Built into our infrastructure and daily operations.">
        <ul className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          {SECURITY_PRACTICES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </PageSection>

      <PageSection title="Reporting" subtitle="Report security issues directly to our team.">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          Email security@linketconnect.com with details and we will respond within 48 hours.
        </div>
      </PageSection>
    </MarketingPage>
  );
}
