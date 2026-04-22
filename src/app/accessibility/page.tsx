import type { Metadata } from "next";

import {
  LegalBulletList,
  LegalCallout,
  LegalCardGrid,
  LegalPage,
  LegalSection,
} from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Linket Connect accessibility statement and support details.",
};

const ACCESSIBILITY_STATS = [
  {
    label: "Target",
    value: "WCAG 2.1 Level AA",
    detail:
      "Our aim is an experience that works well for keyboard users, screen-reader users, and people who need strong visual clarity.",
  },
  {
    label: "Support",
    value: "accessibility@linketconnect.com",
    detail:
      "If something is hard to use, send the page URL and a short description so we can investigate the exact issue.",
  },
  {
    label: "Approach",
    value: "Iterative review and improvement",
    detail:
      "Accessibility is part of ongoing product work, not a one-time pass before launch.",
  },
] as const;

const ACCESSIBILITY_FACTS = [
  { label: "Support", value: "accessibility@linketconnect.com", href: "mailto:accessibility@linketconnect.com" },
  { label: "Focus", value: "Keyboard, screen reader, and low-vision usability" },
  { label: "Applies To", value: "Marketing pages, dashboards, and public profiles" },
] as const;

const PRINCIPLES = [
  {
    eyebrow: "Navigation",
    title: "Keyboard-first interaction",
    description:
      "Interactive elements should be reachable, understandable, and operable without requiring a mouse or touch interaction.",
  },
  {
    eyebrow: "Structure",
    title: "Clear headings and landmarks",
    description:
      "Pages should expose a predictable structure so assistive technologies can move through content without confusion.",
  },
  {
    eyebrow: "Readability",
    title: "Contrast and content clarity",
    description:
      "Copy, controls, and status cues should stay readable and understandable across different devices and visual needs.",
  },
] as const;

const PRACTICES = [
  "Visible focus states help people understand where they are on the page as they tab through the interface.",
  "Labels, helper text, and inline error cues are used to make forms easier to complete and correct.",
  "Meaningful images and icons should include text alternatives when they convey information beyond decoration.",
  "Consistent button language, spacing, and section hierarchy reduce cognitive load across the product.",
] as const;

const REVIEW_NOTES = [
  "We review accessibility during normal design and engineering work rather than treating it as a separate afterthought.",
  "When issues are reported, we prioritize the fixes that block core tasks such as signing in, navigating, saving contact information, or submitting forms.",
  "As the product changes, we re-check important flows because accessibility regressions often appear during routine feature work.",
] as const;

export default function AccessibilityPage() {
  return (
    <LegalPage
      currentPath="/accessibility"
      title="Accessibility statement"
      subtitle="We want Linket to be understandable, navigable, and usable for people with a wide range of access needs and assistive technologies."
      summary="Accessibility work at Linket is centered on practical usability: keyboard access, readable interfaces, clear form behavior, and predictable page structure. This statement explains what we aim for and how to report problems when the experience falls short."
      lastUpdated="April 22, 2026"
      supportLabel="Report an accessibility issue"
      supportHref="mailto:accessibility@linketconnect.com"
      heroStats={ACCESSIBILITY_STATS}
      facts={ACCESSIBILITY_FACTS}
    >
      <LegalSection
        title="What we aim for"
        subtitle="These principles shape how we evaluate accessibility across the site and product."
      >
        <LegalCardGrid items={PRINCIPLES} columns="three" />
      </LegalSection>

      <LegalSection
        title="What this means in practice"
        subtitle="A clean interface only works if it stays usable for the people interacting with it."
      >
        <LegalBulletList items={PRACTICES} />
      </LegalSection>

      <LegalSection
        title="Review and improvement"
        subtitle="Accessibility quality is maintained by checking important tasks repeatedly as the product evolves."
      >
        <LegalBulletList items={REVIEW_NOTES} />
      </LegalSection>

      <LegalSection title="Feedback and support">
        <LegalCallout
          title="Need help using Linket?"
          description="Email accessibility@linketconnect.com with the page URL, the device or browser you were using, and a short description of what made the experience difficult."
          href="mailto:accessibility@linketconnect.com"
          actionLabel="Email accessibility"
        />
      </LegalSection>
    </LegalPage>
  );
}
