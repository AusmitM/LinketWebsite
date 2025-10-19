"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { bindAnalyticsClicks } from "@/lib/analytics" 

const SWATCHES = ["#7fc3e3", "#f49490", "#ffd7c5", "#9fd9b6", "#a79cf5"]

export default function ConfiguratorTeaser() {
  const [color, setColor] = useState(SWATCHES[0])
  const [init, setInit] = useState("LK")
  const [mode, setMode] = useState<"QR" | "NFC">("NFC")
  useEffect(() => bindAnalyticsClicks(), [])

  return (
    <section id="config-teaser" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {/* Controls */}
        <div className="rounded-2xl border bg-card/70 p-6 shadow-sm backdrop-blur">
          <h3 className="text-lg font-semibold">Make it yours</h3>
          <div className="mt-4">
            <div className="text-sm font-medium">Color</div>
            <div className="mt-2 flex items-center gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  aria-label={`Select ${c}`}
                  className="h-8 w-8 rounded-full border"
                  style={{ background: c, outline: color === c ? `2px solid var(--ring)` : undefined }}
                  onClick={() => { setColor(c); const el = document.querySelector(`#preview`); el?.setAttribute("data-analytics-id","config_teaser_color"); el?.dispatchEvent(new Event("click",{bubbles:true}))}}
                />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm font-medium">Initials</div>
            <Input value={init} maxLength={3} onChange={(e) => setInit(e.target.value.toUpperCase())} className="mt-2 max-w-xs" />
          </div>
          <div className="mt-4 inline-flex rounded-full border bg-background p-1 text-xs">
            {(["NFC","QR"] as const).map((m) => (
              <button key={m} className={`rounded-full px-3 py-1 ${mode===m?"bg-[var(--primary)]/20":""}`} onClick={() => setMode(m)}>{m}</button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild data-analytics-id="start_customizing"><a href="/customize">Start customizing</a></Button>
            <Button asChild variant="secondary"><a href="#showcase">Explore designs</a></Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">No account needed to preview.</p>
        </div>

        {/* Preview */}
        <div className="relative rounded-2xl border bg-card/70 p-6 shadow-sm backdrop-blur">
          <motion.div id="preview" className="relative mx-auto aspect-[3/2] w-full max-w-md overflow-hidden rounded-3xl border bg-background" animate={{ boxShadow: `0 20px 60px ${color}40` }}>
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}33, transparent)` }} />
            <div className="absolute right-4 top-4 rounded-full border bg-white/70 px-3 py-1 text-xs text-foreground backdrop-blur">
              {mode === "NFC" ? "One-tap NFC" : "Scan me (QR)"}
            </div>
            <div className="absolute inset-0 grid place-items-center">
              <div className="rounded-2xl border bg-white/80 px-8 py-10 text-5xl font-extrabold tracking-wider text-foreground/80 shadow-sm" style={{ textShadow: `0 1px 0 #fff` }}>
                {init || "LK"}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
