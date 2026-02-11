import type { Metadata } from "next";

import { LEGAL_PAGE_ACTIONS } from "@/components/site/legal-page-actions";
import { MarketingPage, PageSection } from "@/components/site/marketing-page";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Linket Connect accessibility statement and support details.",
};

export default function AccessibilityPage() {
  return (
    <MarketingPage
      kicker="Legal"
      title="Accessibility statement"
      subtitle="We are committed to providing an accessible experience for all visitors, including people who use assistive technologies."
      actions={LEGAL_PAGE_ACTIONS}
    >
      <PageSection title="Our commitment">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          We aim to align with WCAG 2.1 Level AA guidelines and continuously improve usability for keyboard, screen reader, and low-vision users.
        </div>
      </PageSection>

      <PageSection title="Accessibility measures">
        <ul className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          <li>Keyboard-friendly navigation and visible focus states.</li>
          <li>Form labels, help text, and error cues for clarity.</li>
          <li>Text alternatives for meaningful imagery and icons.</li>
          <li>Consistent headings and landmarks for screen readers.</li>
        </ul>
      </PageSection>

      <PageSection title="Feedback and support">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          If you encounter an accessibility issue, email accessibility@linketconnect.com and include the page URL plus a short description of the issue.
        </div>
      </PageSection>

      <PageSection title="Last updated">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          January 2026
        </div>
      </PageSection>
    </MarketingPage>
  );
}
