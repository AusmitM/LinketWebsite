const ROWS = [
  {
    label: "Pricing",
    linket: "One-time hardware with optional add-ons. No mandatory subscription.",
    others: "Typically requires a monthly subscription tier for core features.",
  },
  {
    label: "Brand control",
    linket: "Custom colours, engraving, and instant template swaps from the dashboard.",
    others: "Limited preset colours. Engraving or changes often delay shipping.",
  },
  {
    label: "Setup time",
    linket: "Live preview in under 60 seconds. Ships in 3-5 days.",
    others: "Often needs a companion app and gated templates before sharing.",
  },
  {
    label: "Analytics",
    linket: "Tap analytics included with export options for handoffs.",
    others: "Analytics usually behind a premium plan with restricted exports.",
  },
  {
    label: "Privacy",
    linket: "No trackers. You choose exactly what to capture with every tap.",
    others: "Depends on third-party tracking consent and stored contact data.",
  },
  {
    label: "Support",
    linket: "Concierge email and SMS support 9am-9pm PT, plus bulk onboarding help.",
    others: "Email-only support with limited rollout guidance.",
  },
];

const SNAPSHOT = [
  { label: "Average delivery", linket: "3.2 days", others: "7-10 days" },
  { label: "Starter price", linket: "$19", others: "$29 + $7/mo" },
  { label: "Team rollout", linket: "Bulk dashboard included", others: "Pay per seat" },
];

export default function Comparison() {
  return (
    <section id="comparison" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <header className="mb-8 space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">How Linket compares</h2>
        <p className="text-sm text-muted-foreground">
          A quick look at the decisions that keep Linket simple for teams and accessible for every recipient.
        </p>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="overflow-auto rounded-2xl border bg-card shadow-sm">
          <table className="min-w-full divide-y text-sm" aria-describedby="comparison-note">
            <caption id="comparison-note" className="sr-only">
              Comparison of Linket features with other NFC profile products.
            </caption>
            <thead className="bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">What matters</th>
                <th scope="col" className="px-4 py-3">Linket</th>
                <th scope="col" className="px-4 py-3">Other tap cards</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-4 py-4 text-left text-sm font-medium text-foreground">
                    {row.label}
                  </th>
                  <td className="px-4 py-4 text-sm text-foreground">
                    <span className="block font-semibold">Linket advantage</span>
                    <span className="text-muted-foreground">{row.linket}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    <span className="block font-semibold text-foreground">Others</span>
                    <span>{row.others}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Fast facts</h3>
          <ul className="space-y-3 text-sm">
            {SNAPSHOT.map((item) => (
              <li key={item.label} className="rounded-xl border bg-muted/30 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-base font-semibold text-foreground">{item.linket}</p>
                <p className="text-xs text-muted-foreground">Typical alternative: {item.others}</p>
              </li>
            ))}
          </ul>
          <div className="text-sm text-muted-foreground">
            No upsells required to unlock accessibility features or analytics.
          </div>
        </aside>
      </div>
    </section>
  );
}
