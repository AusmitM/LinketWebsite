import type { Metadata } from "next";

import { MarketingPage, PageSection } from "@/components/site/marketing-page";

export const metadata: Metadata = {
  title: "Warranty",
  description:
    "Official Linket Connect warranty coverage, exclusions, and claim process.",
};

const COVERAGE_WINDOWS = [
  {
    label: "Arrives Right",
    duration: "30 days",
    details:
      "Covers devices that arrive non-functional, incorrect, or with manufacturing defects.",
  },
  {
    label: "Functionality (Individuals)",
    duration: "6 months",
    details:
      "Covers NFC chip failure and structural failure during normal keychain use.",
  },
  {
    label: "Functionality (Businesses)",
    duration: "12 months",
    details:
      "Includes individual functionality coverage plus batch defect handling for affected units.",
  },
] as const;

const EXCLUSIONS = [
  "Lost items.",
  "Cosmetic wear, including scratches, fading, and scuffs.",
  "Water damage or prolonged immersion.",
  "Heat damage, including dashboard or flame exposure.",
  "Crushing, prying, drilling, heavy impact, or unauthorized modifications.",
] as const;

const CLAIM_STEPS = [
  "Submit the order number and clear photo or short video of the issue.",
  "Linket Support confirms eligibility within 2 business days.",
  "Approved replacements ship with standard shipping (expedited options are available).",
] as const;

export default function WarrantyPage() {
  return (
    <MarketingPage
      kicker="Legal"
      title="Linket warranty policy"
      subtitle="Formal coverage terms for Linket hardware and related replacement support."
      actions={[]}
    >
      <PageSection
        title="Coverage windows"
        subtitle="Coverage period begins on the original delivery date."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COVERAGE_WINDOWS.map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-border/60 bg-card/80 p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {item.duration}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">{item.details}</p>
            </article>
          ))}
        </div>
      </PageSection>

      <PageSection title="What is covered">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          <p>
            Linket warranty coverage applies to defects in materials and
            workmanship under normal use. Approved claims are resolved with a
            replacement unit.
          </p>
          <p className="mt-3">
            Individual claims are limited to one replacement per qualifying
            device. Business claims may include replacement of affected units in
            a verified defective batch.
          </p>
        </div>
      </PageSection>

      <PageSection title="Exclusions">
        <ul className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          {EXCLUSIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </PageSection>

      <PageSection
        title="How to file a claim"
        subtitle="Claims are reviewed in the order received."
      >
        <ol className="space-y-2 rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          {CLAIM_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </PageSection>

      <PageSection title="Questions">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          For warranty support, email{" "}
          <span className="font-medium text-foreground">
            support@linketconnect.com
          </span>{" "}
          and include your order number.
        </div>
      </PageSection>

      <PageSection title="Last updated">
        <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
          February 10, 2026
        </div>
      </PageSection>
    </MarketingPage>
  );
}
