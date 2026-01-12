import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Accessibility",
  description: "Linket Connect accessibility statement and support details.",
};

export default function AccessibilityPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-8">
      <div className="space-y-10">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold text-foreground">
            Accessibility Statement
          </h1>
          <p className="text-sm text-muted-foreground">
            We are committed to providing an accessible experience for all
            visitors, including people who use assistive technologies.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Our commitment
          </h2>
          <p className="text-sm text-muted-foreground">
            We aim to align with WCAG 2.1 Level AA guidelines and continuously
            improve usability for keyboard, screen reader, and low-vision users.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Accessibility measures
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Keyboard-friendly navigation and visible focus states.</li>
            <li>Form labels, help text, and error cues for clarity.</li>
            <li>Text alternatives for meaningful imagery and icons.</li>
            <li>Consistent headings and landmarks for screen readers.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground">
            Feedback and support
          </h2>
          <p className="text-sm text-muted-foreground">
            If you encounter an accessibility issue, please contact us so we
            can help. Use the{" "}
            <Link className="underline" href="/contact">
              contact page
            </Link>{" "}
            and include the page URL and a short description of the issue.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">
            Last updated
          </h2>
          <p className="text-sm text-muted-foreground">January 2026</p>
        </section>
      </div>
    </main>
  );
}
