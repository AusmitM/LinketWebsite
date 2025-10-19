export type MetricStat = {
  id: string;
  label: string;
  value: string;
  trend: string;
  trendDirection: "up" | "down" | "flat";
};

export const overviewMetrics: MetricStat[] = [
  { id: "taps_today", label: "Taps today", value: "2,430", trend: "+12% vs yesterday", trendDirection: "up" },
  { id: "conversion", label: "Tap → action", value: "38%", trend: "+4 pts", trendDirection: "up" },
  { id: "orders", label: "Orders shipped", value: "186", trend: "6 pending", trendDirection: "flat" },
  { id: "delivery_time", label: "Avg. delivery", value: "3.1 days", trend: "-0.3 days", trendDirection: "up" },
];

export const tapHotspots = [
  { city: "Austin", taps: 420, x: 36, y: 58 },
  { city: "London", taps: 310, x: 62, y: 35 },
  { city: "Singapore", taps: 190, x: 82, y: 68 },
  { city: "São Paulo", taps: 140, x: 38, y: 74 },
];

export const playbookSuggestions = [
  {
    id: "sms_followup",
    title: "Add a follow-up SMS",
    description: "50 warm leads tapped today but have not booked. Send a 10% off text now.",
    action: "Create SMS automation",
  },
  {
    id: "order_restock",
    title: "Order event badges",
    description: "Inventory for the Campus Fair bundle drops below 25 units.",
    action: "Schedule production run",
  },
  {
    id: "share_template",
    title: "Share a new Linket template",
    description: "Creators marketplace is trending coral gradients. Add it to your library.",
    action: "Publish template",
  },
];

export const healthChecklist = [
  { id: "profile", label: "Profile completeness", status: "complete", helper: "All sections published" },
  { id: "shipping", label: "Shipping status", status: "warning", helper: "6 orders awaiting labels" },
  { id: "messages", label: "Inbox zero", status: "alert", helper: "12 unread conversations" },
  { id: "journeys", label: "Tap journeys", status: "warning", helper: "Personalization tokens not configured" },
];

export const analyticsSeries = [
  { date: "2025-08-01", taps: 820, conversions: 290 },
  { date: "2025-08-02", taps: 910, conversions: 318 },
  { date: "2025-08-03", taps: 760, conversions: 240 },
  { date: "2025-08-04", taps: 980, conversions: 330 },
  { date: "2025-08-05", taps: 1130, conversions: 402 },
  { date: "2025-08-06", taps: 1280, conversions: 468 },
  { date: "2025-08-07", taps: 1395, conversions: 520 },
];

export const analyticsFunnel = [
  { stage: "Tap", value: 3560 },
  { stage: "Profile viewed", value: 2450 },
  { stage: "CTA clicked", value: 980 },
  { stage: "Lead captured", value: 420 },
  { stage: "Order placed", value: 186 },
];

export const analyticsSegments = {
  channels: [
    { label: "Events", share: 46 },
    { label: "One-to-one", share: 31 },
    { label: "Display", share: 14 },
    { label: "QR scan", share: 9 },
  ],
  devices: [
    { label: "iOS", share: 58 },
    { label: "Android", share: 36 },
    { label: "Desktop", share: 6 },
  ],
};

export const analyticsMoments = [
  {
    id: "moment1",
    title: "Creator pop-up spike",
    description: "+320 taps in 2 hours after amber theme release.",
    timestamp: "Aug 6, 3:45 PM",
    impact: "Add follow-up workflow",
  },
  {
    id: "moment2",
    title: "Campus fair conversions",
    description: "Career booth journey delivered 72 booked chats in one day.",
    timestamp: "Aug 5, 8:05 PM",
    impact: "Clone for fall tour",
  },
  {
    id: "moment3",
    title: "Slack digest sent",
    description: "Weekly summary delivered to community-team channel.",
    timestamp: "Aug 5, 7:00 AM",
    impact: "View digest",
  },
];

export const ordersData = [
  {
    id: "#1046",
    customer: "Austin Launch Team",
    eta: "Arrives Aug 10",
    status: "In production",
    items: 50,
    tracking: null,
  },
  {
    id: "#1045",
    customer: "Creator Studio Drop",
    eta: "Delivered Aug 5",
    status: "Delivered",
    items: 24,
    tracking: "1Z8434E9104432",
  },
  {
    id: "#1044",
    customer: "Campus Career Fair",
    eta: "Label ready",
    status: "Ready to ship",
    items: 120,
    tracking: "1Z8434E9104211",
  },
];

export const reorderSuggestions = [
  {
    id: "bundle-campus",
    title: "Campus Fair badge kit",
    description: "Includes 150 NFC badges, 3 table displays, and journeys preloaded.",
    cta: "Restock 150 badges",
  },
  {
    id: "creator-pack",
    title: "Creator tap cards",
    description: "Matte pastel cards with analytics included — trending among top sellers.",
    cta: "Order 50 cards",
  },
];

export const warrantyRequests = [
  { id: "WR-19", customer: "Leo Rivera", issue: "Chip not registering", status: "Awaiting replacement", submitted: "Aug 6" },
  { id: "WR-18", customer: "Campus Fair", issue: "Wrong color", status: "Resolved", submitted: "Aug 3" },
];

export const personaTemplates = [
  { id: "student", name: "Student recruitment", accent: "#bae6fd", primary: "#0f172a", description: "Resume, portfolio, calendar, and follow-up SMS." },
  { id: "creator", name: "Creator commerce", accent: "#f49490", primary: "#0f172a", description: "Shop drop, booking link, tipping, and newsletter." },
  { id: "business", name: "Sales team", accent: "#ffd7c5", primary: "#0f172a", description: "CRM push, case studies, pricing sheet download." },
  { id: "event", name: "Event badge", accent: "#a7f3d0", primary: "#0f172a", description: "Agenda, sponsor highlights, loyalty rewards." },
];

export const profileModules = [
  { id: "bookings", label: "Bookings", description: "Embed Calendly or SavvyCal for instant scheduling." },
  { id: "payments", label: "Payments", description: "Accept Stripe or Square payments on tap." },
  { id: "video", label: "Intro video", description: "Autoplay a branded story or pitch reel." },
  { id: "portfolio", label: "Portfolio", description: "Carousel of projects, Behance, Dribbble, GitHub." },
  { id: "cta", label: "Call-to-action", description: "Primary button, multi-link, or downloadable assets." },
];

export type Message = {
  id: string;
  contact: string;
  channel: "sms" | "whatsapp" | "email";
  subject: string;
  preview: string;
  timeAgo: string;
  unread?: boolean;
  body: string;
  tags: string[];
};

export const inboxMessages: Message[] = [
  {
    id: "msg-1",
    contact: "Maya Chen",
    channel: "sms",
    subject: "Career fair follow-up",
    preview: "Hey! Loved your tap card — can we schedule a quick chat?",
    timeAgo: "5m",
    unread: true,
    body: "Hi Linket team! Loved your tap card at the career fair. I shared it with our hiring manager — can we schedule a quick chat this week?",
    tags: ["student", "warm"],
  },
  {
    id: "msg-2",
    contact: "Leo Rivera",
    channel: "whatsapp",
    subject: "Creator pack reorder",
    preview: "Need 50 more coral cards before Saturday",
    timeAgo: "18m",
    body: "Need 50 more coral cards before Saturday's pop-up. Can you rush production? Also want to test the journey that recommends merch bundles.",
    tags: ["creator", "priority"],
  },
  {
    id: "msg-3",
    contact: "Coastal Coffee",
    channel: "email",
    subject: "Loyalty journey results",
    preview: "The loyalty automation is working",
    timeAgo: "1h",
    body: "Quick note: the loyalty automation is working. We're seeing 38% opt-in. Could your team advise on a follow-up coupon?",
    tags: ["hospitality"],
  },
];

export const smartReplies = [
  "Absolutely — here’s a Calendly link to grab a time.",
  "We can rush production within 48h for an additional $89. Shall I start the order?",
  "Thanks for the update! How about we layer a limited-time offer after the loyalty punch card?",
];

export const followUpSequences = [
  { id: "seq-1", name: "Event warm lead", steps: "SMS in 10m, email recap in 6h, reminder in 2 days" },
  { id: "seq-2", name: "Creator drop", steps: "DM instantly, offer bundle upsell 24h later" },
  { id: "seq-3", name: "Enterprise", steps: "Assign AE, send deck, schedule discovery call" },
];

export const aiSummary = "Maya and Leo are high intent. Maya needs interview follow-up, Leo needs rush production. Coastal Coffee wants strategic advice — route to Customer Success.";

export const automationTasks = [
  { id: "auto-1", title: "Slack weekly digest", schedule: "Fridays 8:00", status: "Active" },
  { id: "auto-2", title: "Campus fair journey", schedule: "Event dates", status: "Paused" },
  { id: "auto-3", title: "VIP reorder reminder", schedule: "Monthly", status: "Active" },
];

export const billingSummary = {
  currentPlan: { name: "Launch", price: "$49/mo", seats: 5, renewsOn: "Sep 12, 2025" },
  usage: { taps: 12840, analyticsSeats: 5, automations: 12 },
  forecast: { nextMonth: "$72", note: "Adds 3 team seats and automation upgrade" },
};

export const invoices = [
  { id: "INV-2043", period: "Aug 2025", amount: "$49.00", status: "Paid", url: "/receipts/INV-2043" },
  { id: "INV-2042", period: "Jul 2025", amount: "$49.00", status: "Paid", url: "/receipts/INV-2042" },
  { id: "INV-2041", period: "Jun 2025", amount: "$68.00", status: "Paid", url: "/receipts/INV-2041" },
];

export const paymentMethods = [
  { id: "pm-1", brand: "Visa", last4: "4242", expiry: "04/28", primary: true },
  { id: "pm-2", brand: "Amex", last4: "3014", expiry: "11/27", primary: false },
];

export const addOnCatalog = [
  { id: "addon-analytics", name: "Advanced analytics", price: "$19", description: "Funnels, cohorts, Slack digests" },
  { id: "addon-journeys", name: "Tap Journeys Pro", price: "$29", description: "Automations, personalization tokens" },
  { id: "addon-hardware", name: "Hardware warranty", price: "$12", description: "24h replacements, asset tracking" },
];

export const walletPasses = [
  { id: "apple", label: "Apple Wallet pass", availability: "Production ready" },
  { id: "google", label: "Google Wallet card", availability: "In review" },
  { id: "pdf", label: "Offline PDF card", availability: "Download anytime" },
];

export const localizedFields = [
  { locale: "English", completeness: 100 },
  { locale: "Spanish", completeness: 76 },
  { locale: "French", completeness: 48 },
];

export const integrationCatalog = [
  { id: "hubspot", name: "HubSpot CRM", status: "Connected", category: "CRM" },
  { id: "salesforce", name: "Salesforce", status: "Available", category: "CRM" },
  { id: "cal", name: "Calendly", status: "Connected", category: "Scheduling" },
  { id: "notion", name: "Notion", status: "Available", category: "Docs" },
];

export const accountSecurity = {
  mfaEnabled: true,
  passkeys: 3,
  sessions: [
    { device: "MacBook Pro", location: "Austin, TX", lastActive: "2m ago" },
    { device: "iPhone 15", location: "Austin, TX", lastActive: "28m ago" },
    { device: "iPad", location: "Dallas, TX", lastActive: "Yesterday" },
  ],
};

export const brandingDefaults = {
  logo: "/logos/avatar-1.svg",
  colors: ["#0f172a", "#7fc3e3", "#f49490"],
  typography: "Quicksand",
};

export const notificationMatrix = [
  { channel: "Email", overview: true, analytics: true, orders: true },
  { channel: "Slack", overview: true, analytics: true, orders: false },
  { channel: "SMS", overview: false, analytics: false, orders: true },
];

export const dataPrivacyToolkit = [
  { id: "export", label: "Export data", helper: "Generate JSON of taps, messages, and orders." },
  { id: "delete", label: "Delete account", helper: "Schedule account purge with 7-day grace." },
  { id: "consent", label: "Consent logs", helper: "Download GDPR/CCPA consent history." },
];

export const tapJourneys = [
  { id: "journey-1", name: "Event warm lead", steps: ["Tap", "Intro video", "CTA: Book a chat", "SMS follow-up"], conversion: "38%" },
  { id: "journey-2", name: "Creator merch drop", steps: ["Tap", "Shop carousel", "Cart", "Upsell bundle"], conversion: "42%" },
];

export const personalizationTokens = [
  { token: "{{first_name}}", usage: "DM greeting", coverage: "82%" },
  { token: "{{device_type}}", usage: "Swap CTA", coverage: "100%" },
  { token: "{{location_city}}", usage: "Localized testimonial", coverage: "65%" },
];

export const socialProofWidgets = [
  { id: "widget-1", type: "Carousel", status: "Live", impressions: "12.4k" },
  { id: "widget-2", type: "Wall of love", status: "Draft", impressions: "--" },
];

export const marketplaceTemplates = [
  { id: "template-amber", name: "Amber Creator", price: "$12", rating: 4.8 },
  { id: "template-campus", name: "Campus Fair", price: "$9", rating: 4.6 },
  { id: "template-lux", name: "Luxury Concierge", price: "$15", rating: 5.0 },
];

export const eventSchedules = [
  { id: "event-1", name: "Startup Summit", start: "Aug 12", Linkets: 180, staff: 12, status: "Ready" },
  { id: "event-2", name: "Campus Tour", start: "Sep 02", Linkets: 320, staff: 20, status: "Planning" },
];

export const loyaltyPrograms = [
  { id: "loyalty-1", name: "Coffee punch card", optIn: "38%", reward: "Free drink" },
  { id: "loyalty-2", name: "Creator VIP", optIn: "54%", reward: "Early drop" },
];

export const hardwareFleet = [
  { id: "device-1", asset: "Tap stand #A1", location: "Austin HQ", battery: "85%", status: "Online" },
  { id: "device-2", asset: "Badge set B", location: "Campus tour", battery: "72%", status: "In transit" },
];

export const monetizationStreams = [
  { id: "stream-1", name: "Direct sales", value: "$12.4k", delta: "+18%" },
  { id: "stream-2", name: "Affiliate commissions", value: "$3.2k", delta: "+5%" },
  { id: "stream-3", name: "Marketplace revenue", value: "$1.7k", delta: "+32%" },
];

export const accessibilityChecklist = [
  { id: "access-1", label: "Color contrast", status: "Pass" },
  { id: "access-2", label: "Keyboard navigation", status: "Needs review" },
  { id: "access-3", label: "Screen reader labels", status: "Pass" },
  { id: "trust-1", label: "SOC 2 attestation", status: "In progress" },
];
