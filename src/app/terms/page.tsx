import type { Metadata } from "next";

import {
  LegalBulletList,
  LegalCallout,
  LegalCardGrid,
  LegalPage,
  LegalSection,
} from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "Linket Connect terms of service and usage guidelines.",
};

const TERMS_STATS = [
  {
    label: "Applies To",
    value: "Accounts, hardware, and hosted pages",
    detail:
      "These terms cover how Linket hardware, profiles, dashboards, and related services are meant to be used.",
  },
  {
    label: "Expected Use",
    value: "Lawful, accurate, and respectful",
    detail:
      "Profiles, lead forms, and shared content should represent real information and be used in professional, non-abusive ways.",
  },
  {
    label: "Questions",
    value: "legal@linketconnect.com",
    detail:
      "If you need a contractual clarification, contact the team directly before relying on an assumption.",
  },
] as const;

const TERMS_FACTS = [
  { label: "Support", value: "legal@linketconnect.com", href: "mailto:legal@linketconnect.com" },
  { label: "Related", value: "Warranty, privacy, and security policies" },
  { label: "Scope", value: "Individual and team use of Linket products" },
] as const;

const TERMS_SCOPE = [
  {
    eyebrow: "Accounts",
    title: "Your dashboard and profile access",
    description:
      "You are responsible for keeping account credentials accurate and secure, and for controlling who can access your Linket workspace.",
  },
  {
    eyebrow: "Hardware",
    title: "Physical Linket items",
    description:
      "Hardware orders, replacements, and defects are handled alongside these terms and the separate warranty policy.",
  },
  {
    eyebrow: "Hosted pages",
    title: "Public profiles and links",
    description:
      "Anything you publish through Linket should be lawful, non-deceptive, and appropriate for the audience you are asking to visit it.",
  },
] as const;

const ACCEPTABLE_USE = [
  "Keep your account details current and protect your login credentials from unauthorized use.",
  "Do not upload malicious, misleading, infringing, or deceptive content to your profile, forms, or linked destinations.",
  "Respect privacy and consent when collecting leads, especially if you use Linket in recruiting, sales, or event settings.",
  "Do not use Linket to route people toward unsafe content, impersonate another person or company, or interfere with the platform.",
  "If you manage a team, make sure each user understands internal approvals and brand standards before publishing changes.",
] as const;

const PRODUCT_AND_BILLING = [
  {
    eyebrow: "Plans",
    title: "Subscriptions and pricing",
    description:
      "Paid plans, bundle pricing, and optional add-ons may change over time. Current pricing is reflected on the site or in the purchase flow.",
  },
  {
    eyebrow: "Product changes",
    title: "Feature updates and maintenance",
    description:
      "We improve Linket continuously, which means features can evolve. When maintenance is planned, we aim to communicate it clearly.",
  },
  {
    eyebrow: "Support",
    title: "Reasonable service expectations",
    description:
      "We work to keep the product available and useful, but no hosted service can promise uninterrupted operation in every circumstance.",
  },
] as const;

const CONTENT_AND_ACCESS = [
  "You retain responsibility for the accuracy of the information you publish, including names, links, lead form prompts, and destination content.",
  "If content or behavior creates risk for users, violates the law, or repeatedly abuses the service, we may limit access while we investigate.",
  "We may remove or disable content that breaks these terms, creates clear operational risk, or is required to be removed for legal reasons.",
  "If you stop using Linket, your rights to access paid or hosted features may end based on your plan status, account state, or applicable policies.",
] as const;

export default function TermsPage() {
  return (
    <LegalPage
      currentPath="/terms"
      title="Terms of service"
      subtitle="A practical set of expectations for using Linket hardware, profiles, analytics, and lead capture responsibly."
      summary="These terms explain how Linket accounts, hosted pages, and physical products are meant to be used. The goal is simple: keep the platform reliable, lawful, and trustworthy for the people sharing it and the people opening it."
      lastUpdated="April 22, 2026"
      supportLabel="Email legal team"
      supportHref="mailto:legal@linketconnect.com"
      heroStats={TERMS_STATS}
      facts={TERMS_FACTS}
    >
      <LegalSection
        title="Who these terms apply to"
        subtitle="Linket combines software, hosted pages, and physical items, so the terms cover each part of that experience."
      >
        <LegalCardGrid items={TERMS_SCOPE} columns="three" />
      </LegalSection>

      <LegalSection
        title="Using Linket responsibly"
        subtitle="The platform works best when profiles are accurate, links are trustworthy, and lead capture is used with consent."
      >
        <LegalBulletList items={ACCEPTABLE_USE} />
      </LegalSection>

      <LegalSection
        title="Orders, plans, and product changes"
        subtitle="Some parts of Linket are purchased once, some may be subscription-based, and the product itself will continue evolving."
      >
        <LegalCardGrid items={PRODUCT_AND_BILLING} columns="three" />
      </LegalSection>

      <LegalSection
        title="Content, access, and suspension"
        subtitle="These points explain who is responsible for published content and when access may be limited."
      >
        <LegalBulletList items={CONTENT_AND_ACCESS} />
      </LegalSection>

      <LegalSection title="Questions or notices">
        <LegalCallout
          title="Need a terms clarification?"
          description="Email legal@linketconnect.com if you need help understanding how these terms apply to your account, hardware order, or team workflow."
          href="mailto:legal@linketconnect.com"
          actionLabel="Contact legal"
        />
      </LegalSection>
    </LegalPage>
  );
}
