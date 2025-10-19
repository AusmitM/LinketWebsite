"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { Heart, Share2, Eye } from "lucide-react"

const TAGS = ["Forest", "Coral", "Sand", "Ocean", "Minimal"] as const
type Tag = (typeof TAGS)[number] | "All"
type Tile = { id: string; name: string; tag: (typeof TAGS)[number]; src: string }

export default function ShowcaseGrid() {
  const [tag, setTag] = useState<Tag>("All")
  const all: Tile[] = useMemo(
    () =>
      Array.from({ length: 9 }).map((_, i) => ({
        id: `s${i}`,
        name: ["Coral Wave","Ocean Breeze","Sandy Path","Forest Mist","Minimal Mint"][i%5] || `Design ${i+1}`,
        tag: TAGS[i % TAGS.length],
        src: "/mockups/keychain.svg",
      })),
    []
  )
  const items = tag === "All" ? all : all.filter((t) => t.tag === tag)
  return (
    <section id="showcase" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["All", ...TAGS] as readonly Tag[]).map((t) => (
          <button key={t} onClick={() => setTag(t)} className={`rounded-full border px-3 py-1.5 text-sm ${t===tag?"bg-[var(--primary)]/20":""}`}>{t}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="group relative overflow-hidden rounded-2xl border bg-card/70 shadow-sm">
            <Image src={it.src} alt={it.name} width={640} height={480} className="h-auto w-full" />
            <div className="p-4">
              <div className="text-sm font-medium">{it.name}</div>
              <div className="text-xs text-muted-foreground">Tag · {it.tag}</div>
            </div>
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:pointer-events-auto group-hover:bg-black/40 group-hover:opacity-100">
              <div className="flex items-center gap-2">
                <Action label="View"><Eye className="h-4 w-4" /></Action>
                <Action label="Favorite"><Heart className="h-4 w-4" /></Action>
                <Action label="Share"><Share2 className="h-4 w-4" /></Action>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Action({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-sm text-foreground backdrop-blur">
      {children}<span>{label}</span>
    </button>
  )
}
