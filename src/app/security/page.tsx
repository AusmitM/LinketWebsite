import type { Metadata } from "next";

import {
  LegalBulletList,
  LegalCallout,
  LegalCardGrid,
  LegalPage,
  LegalSection,
  LegalStepList,
} from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Security",
  description: "Linket Connect security practices and data protection details.",
};

const SECURITY_STATS = [
  {
    label: "Response Goal",
    value: "48-hour initial reply",
    detail:
      "If you report a credible security issue, we aim to acknowledge it quickly and keep the conversation moving.",
  },
  {
    label: "Covers",
    value: "Profiles, routing, dashboards, and lead data",
    detail:
      "Security work spans the hosted product, public profile flows, analytics, and the infrastructure behind them.",
  },
  {
    label: "Report To",
    value: "security@linketconnect.com",
    detail:
      "Send details, reproduction steps, and impact so the team can evaluate the report without guesswork.",
  },
] as const;

const SECURITY_FACTS = [
  { label: "Reporting", value: "security@linketconnect.com", href: "mailto:security@linketconnect.com" },
  { label: "Includes", value: "Encryption, access control, audit awareness" },
  { label: "Focus", value: "Protect live profiles and lead flows" },
] as const;

const SAFEGUARDS = [
  {
    eyebrow: "Data handling",
    title: "Encryption in transit and at rest",
    description:
      "Sensitive product data is protected during transmission and while stored so common traffic and storage risks are reduced.",
  },
  {
    eyebrow: "Access",
    title: "Role-aware dashboard controls",
    description:
      "Access to internal tools and account features is limited to the people who need it, helping reduce unnecessary exposure.",
  },
  {
    eyebrow: "Routing",
    title: "Secure public-page delivery",
    description:
      "QR and NFC routes are designed to resolve to the correct live profile without relying on brittle, manually updated destinations.",
  },
] as const;

const OPERATIONS = [
  "We review product changes, deployment behavior, and configuration updates as part of day-to-day engineering work.",
  "Audit awareness around profile edits and operational activity helps us understand what changed and when.",
  "Vulnerability scanning and targeted fixes are part of the ongoing maintenance needed to keep the service healthy.",
  "No security policy can promise zero risk, so we continuously tighten controls as the product grows.",
] as const;

const REPORTING_STEPS = [
  "Email security@linketconnect.com with the affected surface, reproduction steps, expected impact, and any screenshots or proof-of-concept material that helps explain the issue.",
  "Do not publicly disclose the issue before giving us a reasonable opportunity to investigate and respond.",
  "Avoid actions that would damage customer data, interrupt service, or access accounts that you do not own or have explicit authorization to test.",
  "We will review the report, confirm scope where possible, and follow up with next steps or mitigation details.",
] as const;

const RESPONSE_ITEMS = [
  {
    eyebrow: "Triage",
    title: "Initial acknowledgement",
    description:
      "Our target is an initial response within 48 hours for reports that include enough detail to investigate.",
  },
  {
    eyebrow: "Investigation",
    title: "Context and validation",
    description:
      "We may ask follow-up questions, test reproduction paths, and verify whether the behavior affects customer data or system integrity.",
  },
  {
    eyebrow: "Resolution",
    title: "Mitigation and communication",
    description:
      "Once confirmed, we prioritize a fix, mitigation, or operational response based on severity and keep communication practical and direct.",
  },
] as const;

export default function SecurityPage() {
  return (
    <LegalPage
      currentPath="/security"
      title="Security at Linket"
      subtitle="How we think about protecting live profiles, lead capture, and the infrastructure behind every tap and scan."
      summary="Security at Linket is about practical safeguards: protecting data, limiting access, routing profiles safely, and responding clearly when issues are reported. This page summarizes the controls and reporting path we use today."
      lastUpdated="April 22, 2026"
      supportLabel="Report an issue"
      supportHref="mailto:security@linketconnect.com"
      heroStats={SECURITY_STATS}
      facts={SECURITY_FACTS}
    >
      <LegalSection
        title="Core safeguards"
        subtitle="These are foundational controls built into the product and its supporting systems."
      >
        <LegalCardGrid items={SAFEGUARDS} columns="three" />
      </LegalSection>

      <LegalSection
        title="Operational practices"
        subtitle="Security is not a one-time checklist. It depends on consistent engineering and support discipline."
      >
        <LegalBulletList items={OPERATIONS} />
      </LegalSection>

      <LegalSection
        title="Reporting a vulnerability"
        subtitle="Responsible disclosure works best when the report is specific and the testing stays within authorized limits."
      >
        <LegalStepList items={REPORTING_STEPS} />
      </LegalSection>

      <LegalSection
        title="Response expectations"
        subtitle="We keep the process simple: acknowledge, investigate, and resolve as quickly as the issue allows."
      >
        <LegalCardGrid items={RESPONSE_ITEMS} columns="three" />
      </LegalSection>

      <LegalSection title="Security contact">
        <LegalCallout
          title="Need to report a security concern?"
          description="Email security@linketconnect.com with enough detail for us to reproduce the issue and understand the potential impact."
          href="mailto:security@linketconnect.com"
          actionLabel="Email security"
        />
      </LegalSection>
    </LegalPage>
  );
}
