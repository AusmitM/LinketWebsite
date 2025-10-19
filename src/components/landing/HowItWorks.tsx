export default function HowItWorks() {
  const steps = [
    {
      title: "Design the front",
      description: "Pick colours with sufficient contrast, add initials or your logo, and preview everything in real time.",
    },
    {
      title: "Link what matters",
      description: "Share contact details, socials, and calls to action with clear labels that screen readers can parse.",
    },
    {
      title: "Tap and follow up",
      description: "Every tap opens a lightweight page that works on any device without installing an app.",
    },
  ];

  return (
    <section id="how" className="mx-auto max-w-5xl scroll-mt-24 px-4 py-16 sm:px-6">
      <header className="mb-8 space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">How it works</h2>
        <p className="text-sm text-muted-foreground">
          Three straightforward steps that keep accessibility in mind from setup to sharing.
        </p>
      </header>
      <ol className="space-y-6">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">Step {index + 1}</span>
                <h3 className="mt-1 text-lg font-semibold text-foreground">{step.title}</h3>
              </div>
              <p className="max-w-2xl text-sm text-muted-foreground">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
