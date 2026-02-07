import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

export type AnalyticsTimelinePoint = {
  date: string;
  scans: number;
  leads: number;
};

export type AnalyticsTopProfile = {
  profileId: string | null;
  handle: string | null;
  displayName: string;
  nickname: string | null;
  scans: number;
  leads: number;
};

export type AnalyticsLead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  source_url: string | null;
  handle: string | null;
  created_at: string;
};

export type AnalyticsTotals = {
  scansToday: number;
  leadsToday: number;
  scans7d: number;
  leads7d: number;
  conversionRate7d: number;
  activeTags: number;
  lastScanAt: string | null;
};

export type UserAnalytics = {
  totals: AnalyticsTotals;
  timeline: AnalyticsTimelinePoint[];
  topProfiles: AnalyticsTopProfile[];
  recentLeads: AnalyticsLead[];
  meta: {
    days: number;
    generatedAt: string;
    available: boolean;
  };
};

export type AnalyticsOptions = {
  days?: number;
  recentLeadCount?: number;
};

const DEFAULT_OPTIONS: Required<AnalyticsOptions> = {
  days: 30,
  recentLeadCount: 10,
};

export async function getUserAnalytics(userId: string, options: AnalyticsOptions = {}): Promise<UserAnalytics> {
  const resolved = { ...DEFAULT_OPTIONS, ...options };
  const days = Math.max(1, Math.min(resolved.days, 90));

  if (!isSupabaseAdminAvailable) {
    return {
      totals: {
        scansToday: 0,
        leadsToday: 0,
        scans7d: 0,
        leads7d: 0,
        conversionRate7d: 0,
        activeTags: 0,
        lastScanAt: null,
      },
      timeline: buildEmptyTimeline(days),
      topProfiles: [],
      recentLeads: [],
      meta: {
        days,
        generatedAt: new Date().toISOString(),
        available: false,
      },
    };
  }

  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const end = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999
    )
  );
  const todayKey = dayKey(now);

  const timelineMap = initialiseTimelineMap(start, days);

  const assignments = await fetchAssignments(userId);
  const tagIds = assignments.map((assignment) => assignment.tag_id);
  const profileByHandle = new Map<string, AssignmentProfile>();
  const tagMeta = new Map<string, AssignmentProfile>();

  for (const assignment of assignments) {
    const profile = normaliseAssignment(assignment);
    tagMeta.set(assignment.tag_id, profile);
    if (profile.handle) {
      profileByHandle.set(profile.handle, profile);
    }
  }

  let scansToday = 0;
  let leadsToday = 0;
  let lastScanAt: string | null = null;

  const scansByProfile = new Map<string, ProfileAggregate>();

  if (tagIds.length > 0) {
    const { data: scanRows, error: scanError } = await supabaseAdmin
      .from("tag_events")
      .select("tag_id, occurred_at")
      .eq("event_type", "scan")
      .in("tag_id", tagIds)
      .gte("occurred_at", start.toISOString())
      .lte("occurred_at", end.toISOString())
      .order("occurred_at", { ascending: true });

    if (scanError) {
      throw new Error("Failed to load tag events: " + scanError.message);
    }

    for (const row of scanRows ?? []) {
      if (!row.occurred_at) continue;
      const key = dayKey(row.occurred_at);
      const entry = timelineMap.get(key);
      if (entry) {
        entry.scans += 1;
      }
      if (key === todayKey) scansToday += 1;
      if (!lastScanAt || new Date(row.occurred_at) > new Date(lastScanAt)) {
        lastScanAt = row.occurred_at;
      }

      const profile = tagMeta.get(row.tag_id ?? "");
      const aggregateKey = profile?.profileId || profile?.handle || row.tag_id || "unknown";
      const current = scansByProfile.get(aggregateKey) ?? {
        profileId: profile?.profileId ?? null,
        handle: profile?.handle ?? null,
        displayName: profile?.displayName ?? "Unassigned Linket",
        nickname: profile?.nickname ?? null,
        scans: 0,
        leads: 0,
      };
      current.scans += 1;
      if (profile?.displayName) current.displayName = profile.displayName;
      if (profile?.nickname) current.nickname = profile.nickname;
      scansByProfile.set(aggregateKey, current);
    }
  }

  const { data: leadRows, error: leadsError } = await supabaseAdmin
    .from("leads")
    .select("id, name, email, phone, company, message, source_url, handle, created_at")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString())
    .order("created_at", { ascending: false });

  if (leadsError) {
    throw new Error("Failed to load leads: " + leadsError.message);
  }

  const recentLeads = (leadRows ?? []).slice(0, resolved.recentLeadCount);

  for (const lead of leadRows ?? []) {
    if (!lead.created_at) continue;
    const key = dayKey(lead.created_at);
    const entry = timelineMap.get(key);
    if (entry) {
      entry.leads += 1;
    }
    if (key === todayKey) leadsToday += 1;

    const profile = lead.handle ? profileByHandle.get(lead.handle) : undefined;
    const aggregateKey = profile?.profileId || lead.handle || (lead.id ? "lead-" + lead.id : "lead");
    const current = scansByProfile.get(aggregateKey) ?? {
      profileId: profile?.profileId ?? null,
      handle: profile?.handle ?? lead.handle ?? null,
      displayName: profile?.displayName ?? lead.handle ?? "Public Linket",
      nickname: profile?.nickname ?? null,
      scans: 0,
      leads: 0,
    };
    current.leads += 1;
    scansByProfile.set(aggregateKey, current);
  }

  const timeline = Array.from(timelineMap.values()).sort((a, b) => (a.date < b.date ? -1 : 1));

  const scans7d = sumRange(timeline, 7, (point) => point.scans);
  const leads7d = sumRange(timeline, 7, (point) => point.leads);
  const conversionRate7d = scans7d > 0 ? leads7d / scans7d : 0;

  const topProfiles = Array.from(scansByProfile.values())
    .sort((a, b) => (b.scans === a.scans ? b.leads - a.leads : b.scans - a.scans))
    .slice(0, 8)
    .map((item) => ({
      profileId: item.profileId,
      handle: item.handle,
      displayName: item.displayName,
      nickname: item.nickname ?? null,
      scans: item.scans,
      leads: item.leads,
    }));

  const activeTags = Array.from(scansByProfile.values()).filter((item) => item.scans > 0).length;

  return {
    totals: {
      scansToday,
      leadsToday,
      scans7d,
      leads7d,
      conversionRate7d,
      activeTags,
      lastScanAt,
    },
    timeline,
    topProfiles,
    recentLeads: recentLeads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone ?? null,
      company: lead.company ?? null,
      message: lead.message ?? null,
      source_url: lead.source_url ?? null,
      handle: lead.handle ?? null,
      created_at: lead.created_at,
    })),
    meta: {
      days,
      generatedAt: new Date().toISOString(),
      available: true,
    },
  };
}

type AssignmentRow = {
  tag_id: string;
  nickname: string | null;
  profile: null | {
    id: string;
    name: string | null;
    handle: string | null;
  };
};

type AssignmentProfile = {
  profileId: string | null;
  handle: string | null;
  displayName: string | null;
  nickname: string | null;
};

type ProfileAggregate = {
  profileId: string | null;
  handle: string | null;
  displayName: string;
  nickname: string | null;
  scans: number;
  leads: number;
};

function buildEmptyTimeline(days: number): AnalyticsTimelinePoint[] {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const map = initialiseTimelineMap(start, days);
  return Array.from(map.values());
}

function initialiseTimelineMap(start: Date, days: number) {
  const map = new Map<string, AnalyticsTimelinePoint>();
  for (let i = 0; i < days; i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const key = dayKey(day);
    map.set(key, { date: key, scans: 0, leads: 0 });
  }
  return map;
}

function dayKey(input: string | Date) {
  const d = typeof input === "string" ? new Date(input) : input;
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

async function fetchAssignments(userId: string): Promise<AssignmentRow[]> {
  const { data, error } = await supabaseAdmin
    .from("tag_assignments")
    .select("tag_id, nickname, profile:user_profiles(id, name, handle)")
    .eq("user_id", userId);
  if (error) throw new Error("Failed to load tag assignments: " + error.message);
  // Map profile to a single object if it is an array
  return (data ?? []).map((row: Record<string, unknown>) => {
    let profile = row.profile;
    if (Array.isArray(profile)) {
      profile = profile[0] ?? null;
    }
    return { ...row, profile } as AssignmentRow;
  });
}

function normaliseAssignment(row: AssignmentRow): AssignmentProfile {
  const displayName = row.profile?.name?.trim() || row.nickname?.trim() || null;
  const handle = row.profile?.handle?.trim()?.toLowerCase() || null;
  return {
    profileId: row.profile?.id ?? null,
    handle,
    displayName,
    nickname: row.nickname ?? null,
  };
}

function sumRange(points: AnalyticsTimelinePoint[], days: number, selector: (point: AnalyticsTimelinePoint) => number) {
  const subset = points.slice(-Math.min(days, points.length));
  return subset.reduce((total, point) => total + selector(point), 0);
}
