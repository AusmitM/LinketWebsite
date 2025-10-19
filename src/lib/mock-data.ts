/*
  Deterministic mock data generators for the Dashboard.
  Uses a fixed seed so results are stable across reloads.
*/

export type DashboardSummary = {
  totalTaps7d: number
  ctr7d: number // 0..1
  openOrders: number
  revenueMtd: number
  deltas: { tapsPct: number; ctrPct: number; ordersPct: number; revenuePct: number }
}

export type WeeklyPoint = {
  date: string
  totalTaps: number
  uniqueVisitors: number
  ctr: number
  conversions: number
  channel: "QR" | "NFC" | "Link"
}
export type WeeklyAnalytics = { points: WeeklyPoint[] }

export type Design = {
  id: string
  name: string
  variant: "Forest" | "Coral" | "Sand" | "Ocean"
  status: "Draft" | "Live" | "Archived"
  lastTapAt?: string
  ctr7d: number // 0..1
  previewUrl?: string // placeholder image
}

export type Order = {
  id: string
  date: string
  items: number
  status: "Production" | "QC" | "Shipped"
  progressPct: number // 0..100
  total: number // cents
}

export type Profile = {
  id: string
  displayName: string
  handle: string
  avatarUrl?: string
  tag?: string // e.g., "Student", "Creator"
}

export type ActivityItem = {
  id: string
  type: "order" | "design" | "profile"
  message: string
  at: string
}

export type MessageThread = {
  id: string
  name: string
  snippet: string
  unread: boolean
  updatedAt: string
}

// Mulberry32 deterministic PRNG
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededInt(rand: () => number, min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

const SEED = 42

// Utility to build a simple pastel SVG placeholder
export function svgPlaceholder(text: string, hue = 200) {
  const bg = `hsl(${hue}, 70%, 95%)`
  const fg = `hsl(${hue}, 35%, 35%)`
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'>
      <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0%' stop-color='${bg}'/>
          <stop offset='100%' stop-color='white'/>
        </linearGradient>
      </defs>
      <rect width='100%' height='100%' rx='16' ry='16' fill='url(#g)'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' 
        font-family='system-ui, -apple-system, Segoe UI, Roboto, sans-serif' font-size='18' fill='${fg}'>${text}</text>
    </svg>`
  )
  return `data:image/svg+xml;charset=utf-8,${svg}`
}

export function getWeeklyAnalytics(days = 7): WeeklyAnalytics {
  const rand = mulberry32(SEED + 1)
  const today = new Date()
  const points: WeeklyPoint[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    // Vary baseline by simple wave + randomness
    const base = 120 + Math.round(40 * Math.sin((i / 10) * Math.PI))
    const totalTaps = clamp(Math.round(base + rand() * 60), 40, 320)
    const uniqueVisitors = clamp(Math.round(totalTaps * (0.4 + rand() * 0.2)), 15, totalTaps)
    const conversions = clamp(Math.round(uniqueVisitors * (0.08 + rand() * 0.07)), 0, uniqueVisitors)
    const ctr = clamp(uniqueVisitors ? conversions / uniqueVisitors : 0, 0.03, 0.35)
    const channel: WeeklyPoint["channel"] = rand() > 0.5 ? (rand() > 0.5 ? "NFC" : "QR") : "Link"

    points.push({
      date: d.toISOString().slice(0, 10),
      totalTaps,
      uniqueVisitors,
      ctr: Number(ctr.toFixed(3)),
      conversions,
      channel,
    })
  }
  return { points }
}

export function getDesigns(): Design[] {
  const rand = mulberry32(SEED + 2)
  const variants: Design["variant"][] = ["Forest", "Coral", "Sand", "Ocean"]
  const statuses: Design["status"][] = ["Draft", "Live", "Archived"]
  const count = 10 // 8–12
  const names = [
    "Coral Wave",
    "Ocean Breeze",
    "Sandy Path",
    "Forest Mist",
    "Seafoam Curve",
    "Sunrise Coral",
    "Lagoon Glow",
    "Dune Drift",
    "Reef Spark",
    "Pebble Fade",
  ]
  const designs: Design[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const status = statuses[seededInt(rand, 0, statuses.length - 1)]
    const daysAgo = seededInt(rand, 0, 30)
    const lastTapAt = new Date(now)
    lastTapAt.setDate(now.getDate() - daysAgo)
    designs.push({
      id: `d_${i + 1}`,
      name: names[i] ?? `Design ${i + 1}`,
      variant: variants[i % variants.length],
      status,
      lastTapAt: status === "Archived" ? undefined : lastTapAt.toISOString(),
      ctr7d: Number((0.06 + rand() * 0.22).toFixed(3)),
      previewUrl: svgPlaceholder(names[i] ?? `Design ${i + 1}`, 180 + i * 12),
    })
  }
  return designs
}

export function getOrders(): Order[] {
  const rand = mulberry32(SEED + 3)
  const statuses: Order["status"][] = ["Production", "QC", "Shipped"]
  const count = 6 // 4–8
  const now = new Date()
  const orders: Order[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(now)
    date.setDate(now.getDate() - i * 3)
    const status = statuses[seededInt(rand, 0, statuses.length - 1)]
    const progressBase = status === "Production" ? 35 : status === "QC" ? 70 : 100
    const progressPct = clamp(progressBase + seededInt(rand, -10, 10), 10, 100)
    orders.push({
      id: `#10${40 + i}`,
      date: date.toISOString(),
      items: seededInt(rand, 1, 4),
      status,
      progressPct,
      total: seededInt(rand, 2500, 18900),
    })
  }
  return orders
}

export function getProfiles(): Profile[] {
  const people = [
    { name: "Punit @ TAMU", handle: "punit", tag: "Student" },
    { name: "Coral Studio", handle: "coral", tag: "Creator" },
    { name: "Ocean Labs", handle: "ocean", tag: "Maker" },
    { name: "Sand & Co.", handle: "sand", tag: "Brand" },
  ]
  return people.map((p, i) => ({
    id: `p_${i + 1}`,
    displayName: p.name,
    handle: p.handle,
    tag: p.tag,
    avatarUrl: svgPlaceholder(p.name, 200 + i * 15),
  }))
}

export function getActivity(): ActivityItem[] {
  const items: ActivityItem[] = [
    { id: "a1", type: "order", message: "Order #1045 shipped", at: daysAgo(1) },
    { id: "a2", type: "design", message: "Design ‘Coral Wave’ published", at: daysAgo(2) },
    { id: "a3", type: "profile", message: "Profile ‘Punit @ TAMU’ updated", at: daysAgo(2) },
    { id: "a4", type: "order", message: "Order #1044 moved to QC", at: daysAgo(4) },
    { id: "a5", type: "design", message: "Design ‘Lagoon Glow’ duplicated", at: daysAgo(5) },
    { id: "a6", type: "order", message: "Order #1043 in production", at: daysAgo(6) },
    { id: "a7", type: "profile", message: "New team member added", at: daysAgo(9) },
    { id: "a8", type: "design", message: "Design ‘Dune Drift’ archived", at: daysAgo(12) },
    { id: "a9", type: "order", message: "Order #1042 delivered", at: daysAgo(14) },
    { id: "a10", type: "design", message: "Variant colors refreshed", at: daysAgo(15) },
  ]
  return items
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export function getMessages(): MessageThread[] {
  const now = new Date()
  const mk = (offsetMins: number) => new Date(now.getTime() - offsetMins * 60_000).toISOString()
  return [
    { id: "m1", name: "Alex Fuller", snippet: "Can we tweak the coral…", unread: true, updatedAt: mk(12) },
    { id: "m2", name: "Ocean Labs", snippet: "Logo asset attached.", unread: false, updatedAt: mk(55) },
    { id: "m3", name: "Dune Cafe", snippet: "Thanks! Order received.", unread: false, updatedAt: mk(180) },
  ]
}

export function getDashboardSummary(): DashboardSummary {
  const weekly = getWeeklyAnalytics(7).points
  const totalTaps7d = weekly.reduce((a, p) => a + p.totalTaps, 0)
  const ctr7d = clamp(
    weekly.reduce((a, p) => a + p.ctr, 0) / weekly.length,
    0.04,
    0.35
  )
  const orders = getOrders()
  const openOrders = orders.filter((o) => o.status !== "Shipped").length
  // MTD revenue from shipped + some QC
  const revenueMtd = orders
    .filter((o) => o.status !== "Production")
    .reduce((a, o) => a + o.total, 0)

  // Simple deltas derived from last 14d vs last 7d
  const prev = getWeeklyAnalytics(14).points.slice(0, 7).reduce((a, p) => a + p.totalTaps, 0)
  const tapsPct = prev ? (totalTaps7d - prev) / prev : 0
  const ctrPct = 0.02 // tiny improvement
  const ordersPct = -0.1 // slight down
  const revenuePct = 0.08

  return {
    totalTaps7d,
    ctr7d: Number(ctr7d.toFixed(3)),
    openOrders,
    revenueMtd,
    deltas: {
      tapsPct: Number(tapsPct.toFixed(3)),
      ctrPct,
      ordersPct,
      revenuePct,
    },
  }
}

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number }

export function getDesignsPaged(page = 1, pageSize = 8): Paged<Design> {
  const all = getDesigns()
  const total = all.length
  const start = (page - 1) * pageSize
  const items = all.slice(start, start + pageSize)
  return { items, page, pageSize, total }
}

