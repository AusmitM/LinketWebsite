import type { Metadata } from "next";

import { LEGAL_PAGE_ACTIONS } from "@/components/site/legal-page-actions";
import { MarketingPage, PageSection } from "@/components/site/marketing-page";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Learn how Linket Connect collects, uses, and protects your data.",
};

const SECTIONS = [
  {
    title: "Information we collect",
    points: [
      "Account details such as name, email, and organization.",
      "Profile content you provide to share through Linket.",
      "Analytics on taps, scans, and lead form submissions.",
    ],
  },
  {
    title: "How we use data",
    points: [
      "Operate and improve Linket hardware and services.",
      "Deliver analytics dashboards and performance insights.",
      "Provide support and respond to requests.",
    ],
  },
  {
    title: "Data controls",
    points: [
      "Export or delete your data upon request.",
      "Manage privacy settings inside the Linket dashboard.",
      "Contact support for any questions or concerns.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <MarketingPage
      kicker="Legal"
      title="Privacy policy"
      subtitle="We protect your data and only use it to power your Linket experience."
      actions={LEGAL_PAGE_ACTIONS}
    >
      {SECTIONS.map((section) => (
        <PageSection key={section.title} title={section.title}>
          <ul className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
            {section.points.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </PageSection>
      ))}
      <PageSection title="Contact">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          Privacy questions? Email privacy@linketconnect.com.
        </div>
      </PageSection>
    </MarketingPage>
  );
}
