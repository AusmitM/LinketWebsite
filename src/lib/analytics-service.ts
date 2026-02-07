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

export async function getUserAnalytics(
  userId: string,
  options: AnalyticsOptions = {}
): Promise<UserAnalytics> {
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

  const [assignments, profileRows] = await Promise.all([
    fetchAssignments(userId),
    fetchProfilesForUser(userId),
  ]);

  const tagIds = assignments.map((assignment) => assignment.tag_id);
  const profileByHandle = new Map<string, AssignmentProfile>();
  const profileById = new Map<string, AssignmentProfile>();
  const tagMeta = new Map<string, AssignmentProfile>();

  for (const profile of profileRows) {
    const normalized: AssignmentProfile = {
      profileId: profile.id,
      handle: profile.handle?.trim()?.toLowerCase() || null,
      displayName: profile.name?.trim() || null,
      nickname: null,
    };
    profileById.set(profile.id, normalized);
    if (normalized.handle) {
      profileByHandle.set(normalized.handle, normalized);
    }
  }

  for (const assignment of assignments) {
    const normalized = normaliseAssignment(assignment);
    tagMeta.set(assignment.tag_id, normalized);
    if (normalized.profileId) {
      const fromProfiles = profileById.get(normalized.profileId);
      if (fromProfiles) {
        if (!fromProfiles.nickname && normalized.nickname) {
          profileById.set(normalized.profileId, {
            ...fromProfiles,
            nickname: normalized.nickname,
          });
        }
      } else {
        profileById.set(normalized.profileId, normalized);
      }
    }
    if (normalized.handle && !profileByHandle.has(normalized.handle)) {
      profileByHandle.set(normalized.handle, normalized);
    }
  }

  let scansToday = 0;
  let leadsToday = 0;
  let lastScanAt: string | null = null;
  const scansByProfile = new Map<string, ProfileAggregate>();
  const activeTagIds = new Set<string>();

  const scanRows = await fetchScanRowsForUser({
    userId,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    tagIds,
  });

  for (const row of scanRows) {
    if (!row.occurred_at) continue;
    const key = dayKey(row.occurred_at);
    const entry = timelineMap.get(key);
    if (entry) entry.scans += 1;
    if (key === todayKey) scansToday += 1;
    if (!lastScanAt || new Date(row.occurred_at) > new Date(lastScanAt)) {
      lastScanAt = row.occurred_at;
    }
    if (row.tag_id) activeTagIds.add(row.tag_id);

    const metadataProfileId =
      readMetadataValue(row.metadata, "owner_profile_id") ||
      readMetadataValue(row.metadata, "profile_id");
    const profileFromMetadata = metadataProfileId
      ? profileById.get(metadataProfileId)
      : undefined;
    const profileFromTag = row.tag_id ? tagMeta.get(row.tag_id) : undefined;
    const profile = profileFromMetadata ?? profileFromTag;

    const aggregateKey =
      profileFromMetadata?.profileId ||
      profile?.profileId ||
      profile?.handle ||
      row.tag_id ||
      row.id ||
      "unknown";

    const current = scansByProfile.get(aggregateKey) ?? {
      profileId: profile?.profileId ?? metadataProfileId ?? null,
      handle: profile?.handle ?? null,
      displayName: profile?.displayName ?? "Unassigned Linket",
      nickname: profile?.nickname ?? null,
      scans: 0,
      leads: 0,
    };
    current.scans += 1;
    if (profile?.displayName) current.displayName = profile.displayName;
    if (profile?.nickname) current.nickname = profile.nickname;
    if (!current.profileId && metadataProfileId) {
      current.profileId = metadataProfileId;
    }
    scansByProfile.set(aggregateKey, current);
  }

  const { data: leadRows, error: leadsError } = await supabaseAdmin
    .from("leads")
    .select(
      "id, name, email, phone, company, message, source_url, handle, created_at"
    )
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
    if (entry) entry.leads += 1;
    if (key === todayKey) leadsToday += 1;

    const normalizedHandle = lead.handle?.trim()?.toLowerCase() || null;
    const profile = normalizedHandle
      ? profileByHandle.get(normalizedHandle)
      : undefined;
    const aggregateKey =
      profile?.profileId ||
      normalizedHandle ||
      (lead.id ? `lead-${lead.id}` : "lead");

    const current = scansByProfile.get(aggregateKey) ?? {
      profileId: profile?.profileId ?? null,
      handle: profile?.handle ?? normalizedHandle ?? null,
      displayName: profile?.displayName ?? normalizedHandle ?? "Public Linket",
      nickname: profile?.nickname ?? null,
      scans: 0,
      leads: 0,
    };
    current.leads += 1;
    scansByProfile.set(aggregateKey, current);
  }

  const timeline = Array.from(timelineMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : 1
  );
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

  return {
    totals: {
      scansToday,
      leadsToday,
      scans7d,
      leads7d,
      conversionRate7d,
      activeTags: activeTagIds.size,
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

type UserProfileRow = {
  id: string;
  name: string | null;
  handle: string | null;
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

type ScanRow = {
  id: string;
  tag_id: string | null;
  occurred_at: string | null;
  metadata: Record<string, unknown> | null;
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
  return (data ?? []).map((row: Record<string, unknown>) => {
    let profile = row.profile;
    if (Array.isArray(profile)) {
      profile = profile[0] ?? null;
    }
    return { ...row, profile } as AssignmentRow;
  });
}

async function fetchProfilesForUser(userId: string): Promise<UserProfileRow[]> {
  const { data, error } = await supabaseAdmin
    .from("user_profiles")
    .select("id, name, handle")
    .eq("user_id", userId);
  if (error) throw new Error("Failed to load profiles: " + error.message);
  return (data ?? []) as UserProfileRow[];
}

async function fetchScanRowsForUser(options: {
  userId: string;
  startIso: string;
  endIso: string;
  tagIds: string[];
}): Promise<ScanRow[]> {
  const { userId, startIso, endIso, tagIds } = options;
  const rowsById = new Map<string, ScanRow>();
  let metadataQueriesFailed = false;

  for (const metadataKey of ["owner_user_id", "user_id"] as const) {
    try {
      const { data, error } = await supabaseAdmin
        .from("tag_events")
        .select("id, tag_id, occurred_at, metadata")
        .eq("event_type", "scan")
        .gte("occurred_at", startIso)
        .lte("occurred_at", endIso)
        .filter(`metadata->>${metadataKey}`, "eq", userId)
        .order("occurred_at", { ascending: true });

      if (error) throw error;
      for (const row of (data ?? []) as ScanRow[]) {
        if (!row.id) continue;
        rowsById.set(row.id, row);
      }
    } catch {
      metadataQueriesFailed = true;
    }
  }

  if (rowsById.size === 0 && metadataQueriesFailed && tagIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("tag_events")
      .select("id, tag_id, occurred_at, metadata")
      .eq("event_type", "scan")
      .in("tag_id", tagIds)
      .gte("occurred_at", startIso)
      .lte("occurred_at", endIso)
      .order("occurred_at", { ascending: true });
    if (error) {
      throw new Error("Failed to load tag events: " + error.message);
    }
    for (const row of (data ?? []) as ScanRow[]) {
      if (!row.id) continue;
      rowsById.set(row.id, row);
    }
  }

  return Array.from(rowsById.values()).sort((a, b) => {
    const left = a.occurred_at || "";
    const right = b.occurred_at || "";
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

function readMetadataValue(
  metadata: Record<string, unknown> | null,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function sumRange(
  points: AnalyticsTimelinePoint[],
  days: number,
  selector: (point: AnalyticsTimelinePoint) => number
) {
  const subset = points.slice(-Math.min(days, points.length));
  return subset.reduce((total, point) => total + selector(point), 0);
}
