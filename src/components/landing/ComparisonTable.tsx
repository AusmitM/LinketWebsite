import { Check, Minus } from "lucide-react"

const rows = [
  { k: "Tactile physical presence", ours: true, dot: false, popl: false },
  { k: "Fully customizable colors/logo", ours: true, dot: true, popl: true },
  { k: "Water-resistant body", ours: true, dot: true, popl: true },
  { k: "Replaceable tag", ours: true, dot: false, popl: false },
  { k: "Analytics", ours: true, dot: true, popl: true },
  { k: "Price per unit (from)", ours: "$19", dot: "$24", popl: "$25" },
  { k: "Bulk/team features", ours: true, dot: true, popl: true },
  { k: "Warranty", ours: true, dot: true, popl: true },
]

export default function ComparisonTable() {
  return (
    <section id="comparison" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <Th />
              <Th className="bg-[var(--primary)]/10">Keychain (Us)</Th>
              <Th>Dot</Th>
              <Th>Popl</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="even:bg-muted/20">
                <Td className="font-medium">{r.k}</Td>
                <Td className="bg-[var(--primary)]/5">{renderCell(r.ours)}</Td>
                <Td>{renderCell(r.dot)}</Td>
                <Td>{renderCell(r.popl)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 max-w-3xl text-sm text-muted-foreground">
        Why a keychain beats a flat card: it’s tactile, visible, and gets conversations started. Carry it anywhere without wallets. Add your logo and switch profiles anytime.
        <a href="#" className="ml-2 underline underline-offset-4">Read the full guide</a>.
      </div>
    </section>
  )
}

function renderCell(v: boolean | string) {
  if (typeof v === "string") return <span>{v}</span>
  return v ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700"><Check className="h-4 w-4" /> Yes</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-400/10 px-2 py-0.5 text-slate-600"><Minus className="h-4 w-4" /> —</span>
  )
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th scope="col" className={`p-3 text-left font-semibold ${className}`}>{children}</th>
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`p-3 align-middle ${className}`}>{children}</td>
}
