const PRESETS = [
  {
    label: "Midnight on ice",
    initials: "LC",
    description: "Deep navy text on a soft blue gradient keeps initials sharp without glare.",
    start: "#dbeafe",
    end: "#0f172a",
  },
  {
    label: "Coral contrast",
    initials: "MA",
    description: "Warm coral paired with cream surfaces stays readable under bright lighting.",
    start: "#fff1f2",
    end: "#f97316",
  },
  {
    label: "Forest focus",
    initials: "JT",
    description: "Earthy greens with a white centre give plenty of contrast for bold logos.",
    start: "#ecfdf5",
    end: "#047857",
  },
];

export default function Showcase() {
  return (
    <section id="showcase" className="border-t border-b bg-muted/20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <header className="mb-8 space-y-2 text-center">
          <h2 className="text-2xl font-semibold text-foreground sm:text-3xl">Accessible finishes</h2>
          <p className="text-sm text-muted-foreground">
            Every preset aims for strong colour contrast and enough whitespace for initials or logos.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {PRESETS.map((preset) => (
            <article key={preset.label} className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm" aria-label={`Preview called ${preset.label}`}>
              <div
                className="relative flex aspect-[4/3] items-center justify-center rounded-xl border"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                }}
              >
                <span className="rounded-full bg-white/90 px-5 py-3 text-2xl font-semibold text-slate-900">
                  {preset.initials}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <h3 className="text-base font-semibold text-foreground">{preset.label}</h3>
                <p className="text-muted-foreground">{preset.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
