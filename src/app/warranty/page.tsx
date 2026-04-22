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
  title: "Warranty",
  description:
    "Official Linket Connect warranty coverage, exclusions, and claim process.",
};

const WARRANTY_STATS = [
  {
    label: "Arrives Right",
    value: "30 days",
    detail:
      "Items that arrive non-functional, incorrect, or clearly defective can be reported during the first 30 days after delivery.",
  },
  {
    label: "Individuals",
    value: "6 months",
    detail:
      "Individual functionality coverage applies to eligible failures during normal day-to-day keychain use.",
  },
  {
    label: "Businesses",
    value: "12 months",
    detail:
      "Business coverage extends the functionality window and helps address verified batch defects affecting multiple units.",
  },
] as const;

const WARRANTY_FACTS = [
  { label: "Support", value: "support@linketconnect.com", href: "mailto:support@linketconnect.com" },
  { label: "Covers", value: "Defects in materials and workmanship" },
  { label: "Resolution", value: "Full Linket replacement after approval" },
] as const;

const COVERAGE_WINDOWS = [
  {
    eyebrow: "Arrival protection",
    title: "30-day arrives-right window",
    description:
      "Use this if a device shows up incorrect, damaged from manufacturing, or unable to function as intended right away.",
  },
  {
    eyebrow: "Individual use",
    title: "6-month functionality coverage",
    description:
      "This covers eligible NFC chip failure or structural failure that happens during normal personal use of the product.",
  },
  {
    eyebrow: "Business orders",
    title: "12-month business coverage",
    description:
      "Business customers receive extended functionality coverage plus support when a verified defect affects a broader group of units.",
  },
] as const;

const COVERED_ITEMS = [
  "Manufacturing defects that prevent the Linket from functioning correctly.",
  "NFC chip failure under normal usage conditions.",
  "Structural failure that happens during ordinary keychain use and was not caused by misuse or modification.",
] as const;

const EXCLUSIONS = [
  "Lost items or missing units after delivery.",
  "Cosmetic wear such as scratches, fading, or surface scuffs.",
  "Water damage or prolonged immersion.",
  "Heat damage, including dashboard or flame exposure.",
  "Crushing, prying, drilling, heavy impact, or unauthorized modifications.",
] as const;

const CLAIM_STEPS = [
  "Send your order number together with a clear photo or short video that shows the issue.",
  "The Linket team reviews the claim and confirms eligibility, usually within two business days.",
  "If the claim is approved, we replace the entire Linket unit and ship it at the customer's expense.",
] as const;

const REPLACEMENT_DETAILS = [
  {
    eyebrow: "Resolution",
    title: "Full Linket replacement",
    description:
      "Approved warranty claims are resolved by replacing the entire Linket itself rather than repairing a component or issuing a cash reimbursement.",
  },
  {
    eyebrow: "Shipping",
    title: "Customer-paid replacement shipping",
    description:
      "When a warranty replacement is approved, shipping for the replacement unit is paid by the customer.",
  },
  {
    eyebrow: "Limit",
    title: "One replacement per user per month",
    description:
      "Warranty replacements are limited to one approved replacement per user during any single calendar month.",
  },
] as const;

export default function WarrantyPage() {
  return (
    <LegalPage
      currentPath="/warranty"
      title="Linket warranty policy"
      subtitle="Coverage details for Linket hardware, what is excluded, and how to file a replacement claim when something goes wrong."
      summary="The warranty is built to cover real product defects, not general wear or accidental damage. If a Linket arrives wrong or fails during normal use inside the covered window, we review the issue and, when approved, replace the entire Linket with shipping charged to the customer."
      lastUpdated="April 22, 2026"
      supportLabel="Email support"
      supportHref="mailto:support@linketconnect.com"
      heroStats={WARRANTY_STATS}
      facts={WARRANTY_FACTS}
    >
      <LegalSection
        title="Coverage windows"
        subtitle="Coverage begins on the original delivery date of the order."
      >
        <LegalCardGrid items={COVERAGE_WINDOWS} columns="three" />
      </LegalSection>

      <LegalSection
        title="What is covered and what is not"
        subtitle="Warranty coverage is limited to defects in materials and workmanship during normal use."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-slate-200 bg-[#fffdfa] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#e3a553]">
              Covered
            </p>
            <h3 className="mt-2 text-base font-semibold text-slate-900">
              Eligible defects
            </h3>
            <div className="mt-4">
              <LegalBulletList items={COVERED_ITEMS} />
            </div>
          </article>
          <article className="rounded-[24px] border border-slate-200 bg-[#fffdfa] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#34afcf]">
              Not covered
            </p>
            <h3 className="mt-2 text-base font-semibold text-slate-900">
              Exclusions
            </h3>
            <div className="mt-4">
              <LegalBulletList items={EXCLUSIONS} />
            </div>
          </article>
        </div>
      </LegalSection>

      <LegalSection
        title="How to file a claim"
        subtitle="Claims move faster when the order number and issue evidence are included from the start."
      >
        <LegalStepList items={CLAIM_STEPS} />
      </LegalSection>

      <LegalSection
        title="Replacement details"
        subtitle="Here is how approved claims are typically resolved once eligibility is confirmed."
      >
        <LegalCardGrid items={REPLACEMENT_DETAILS} columns="three" />
      </LegalSection>

      <LegalSection title="Warranty support">
        <LegalCallout
          title="Need help with a hardware issue?"
          description="Email support@linketconnect.com and include your order number, the affected item, and a clear photo or short video of the problem. Approved claims receive a full Linket replacement, with shipping paid by the customer."
          href="mailto:support@linketconnect.com"
          actionLabel="Contact support"
        />
      </LegalSection>
    </LegalPage>
  );
}
