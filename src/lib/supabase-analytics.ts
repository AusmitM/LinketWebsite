// lib/supabase-analytics.ts
import { supabase } from "@/lib/supabase";

export interface TapLead {
  id: string;
  linket_id: string;
  action: string;
  created_at: string;
}

export interface Linket {
  linket_id: string;
  user_id: string;
  created_at: string;
  linket_tag: string | null;
}

export interface LinketProfile {
  profile_id: string;
  linket_id: string;
  profile_name: string;
  handle: string;
  headline: string | null;
  profile_path: string | null;
  theme: number | null;
  created_at: string;
}

export interface VCard {
  user_id: string;
  profile_path: string;
  full_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

export interface UserAnalytics {
  meta: {
    available: boolean;
    generatedAt: string;
  };
  totals: {
    scansToday: number;
    leadsToday: number;
    scans7d: number;
    leads7d: number;
    conversionRate7d: number;
    activeTags: number;
    lastScanAt: string | null;
  } | null;
  timeline: Array<{
    date: string;
    scans: number;
    leads: number;
  }>;
  topProfiles: Array<{
    profileId: string;
    scans: number;
    leads: number;
    handle?: string;
    displayName?: string;
    nickname?: string;
  }>;
  recentLeads: Array<{
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    message: string | null;
    created_at: string;
  }>;
}

/**
 * Fetch all taps and leads for a user
 */
export async function fetchUserTaps(userId: string, days: number = 30) {
  console.log(
    `[fetchUserTaps] Starting fetch for user ${userId}, days ${days}`
  );

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // First get all linkets for this user
  const { data: linkets, error: linketsError } = await supabase
    .from("linkets")
    .select("linket_id")
    .eq("user_id", userId);

  if (linketsError) {
    console.error(`[fetchUserTaps] Linkets error:`, linketsError);
    throw linketsError;
  }

  console.log(`[fetchUserTaps] Found ${linkets?.length || 0} linkets for user`);

  if (!linkets || linkets.length === 0) {
    console.log(`[fetchUserTaps] No linkets found, returning empty array`);
    return [];
  }

  const linketIds = linkets.map((l) => l.linket_id);
  console.log(`[fetchUserTaps] Fetching taps for linket IDs:`, linketIds);

  // Get all taps/leads for these linkets
  const { data: taps, error: tapsError } = await supabase
    .from("taps_leads")
    .select("*")
    .in("linket_id", linketIds)
    .gte("created_at", cutoffDate.toISOString())
    .order("created_at", { ascending: true });

  if (tapsError) {
    console.error(`[fetchUserTaps] Taps error:`, tapsError);
    throw tapsError;
  }

  console.log(`[fetchUserTaps] Found ${taps?.length || 0} taps/leads`);
  return taps || [];
}

/**
 * Fetch linket profiles with their associated data
 */
export async function fetchUserLinketProfiles(userId: string) {
  // Get linkets for user
  const { data: linkets, error: linketsError } = await supabase
    .from("linkets")
    .select("*")
    .eq("user_id", userId);

  if (linketsError) throw linketsError;
  if (!linkets || linkets.length === 0) return [];

  const linketIds = linkets.map((l) => l.linket_id);

  // Get profiles for these linkets
  const { data: profiles, error: profilesError } = await supabase
    .from("linket_profiles")
    .select("*")
    .in("linket_id", linketIds);

  if (profilesError) throw profilesError;
  return profiles || [];
}

/**
 * Fetch vcard data for leads
 */
export async function fetchLeadVCards(userId: string, limit: number = 50) {
  const { data: vcards, error } = await supabase
    .from("vcard")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return vcards || [];
}

/**
 * Process raw data into UserAnalytics format
 */
export async function processUserAnalytics(
  userId: string,
  days: number = 30
): Promise<UserAnalytics> {
  try {
    console.log(
      `[Supabase Analytics] Starting analytics processing for user ${userId}`
    );

    // Fetch all data in parallel
    const [taps, profiles, vcards] = await Promise.all([
      fetchUserTaps(userId, days),
      fetchUserLinketProfiles(userId),
      fetchLeadVCards(userId, 100),
    ]);

    console.log(`[Supabase Analytics] Data fetched:`, {
      taps: taps.length,
      profiles: profiles.length,
      vcards: vcards.length,
    });

    // Get date boundaries
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Filter scans (action = 'taps')
    const scans = taps.filter((t) => t.action === "taps");
    const scansToday = scans.filter((t) => new Date(t.created_at) >= today);
    const scans7d = scans.filter((t) => new Date(t.created_at) >= sevenDaysAgo);

    // Filter leads (action = 'lead')
    const leads = taps.filter((t) => t.action === "lead");
    const leadsToday = leads.filter((t) => new Date(t.created_at) >= today);
    const leads7d = leads.filter((t) => new Date(t.created_at) >= sevenDaysAgo);

    // Calculate conversion rate
    const conversionRate7d =
      scans7d.length > 0 ? leads7d.length / scans7d.length : 0;

    // Get active tags (linkets with scans in last 7 days)
    const activeLinketIds = new Set(scans7d.map((s) => s.linket_id));
    const activeTags = activeLinketIds.size;

    // Find last scan
    const lastScanAt =
      scans.length > 0
        ? new Date(scans[scans.length - 1].created_at).toISOString()
        : null;

    // Build timeline data (daily aggregation)
    const timelineMap = new Map<string, { scans: number; leads: number }>();

    taps.forEach((tap) => {
      const date = new Date(tap.created_at);
      const dateKey = date.toISOString().split("T")[0];

      if (!timelineMap.has(dateKey)) {
        timelineMap.set(dateKey, { scans: 0, leads: 0 });
      }

      const entry = timelineMap.get(dateKey)!;
      if (tap.action === "taps") {
        entry.scans++;
      } else if (tap.action === "lead") {
        entry.leads++;
      }
    });

    const timeline = Array.from(timelineMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build top profiles
    const profileStatsMap = new Map<
      string,
      {
        profileId: string;
        scans: number;
        leads: number;
        handle?: string;
        displayName?: string;
        nickname?: string;
      }
    >();

    scans7d.forEach((scan) => {
      const profile = profiles.find((p) => p.linket_id === scan.linket_id);
      const key = profile?.profile_id || scan.linket_id;

      if (!profileStatsMap.has(key)) {
        profileStatsMap.set(key, {
          profileId: key,
          scans: 0,
          leads: 0,
          handle: profile?.handle,
          displayName: profile?.profile_name,
          nickname: undefined,
        });
      }

      profileStatsMap.get(key)!.scans++;
    });

    leads7d.forEach((lead) => {
      const profile = profiles.find((p) => p.linket_id === lead.linket_id);
      const key = profile?.profile_id || lead.linket_id;

      if (profileStatsMap.has(key)) {
        profileStatsMap.get(key)!.leads++;
      }
    });

    const topProfiles = Array.from(profileStatsMap.values())
      .sort((a, b) => b.scans - a.scans)
      .slice(0, 10);

    // Build recent leads from vcards
    const recentLeads = vcards.slice(0, 10).map((vcard) => ({
      id: vcard.user_id + "-" + vcard.created_at,
      name: vcard.full_name || null,
      email: vcard.email || null,
      phone: vcard.phone || null,
      company: vcard.company || null,
      message: vcard.notes || null,
      created_at: vcard.created_at,
    }));

    return {
      meta: {
        available: true,
        generatedAt: new Date().toISOString(),
      },
      totals: {
        scansToday: scansToday.length,
        leadsToday: leadsToday.length,
        scans7d: scans7d.length,
        leads7d: leads7d.length,
        conversionRate7d,
        activeTags,
        lastScanAt,
      },
      timeline,
      topProfiles,
      recentLeads,
    };
  } catch (error) {
    console.error("Error processing analytics:", error);
    throw error;
  }
}

/**
 * API endpoint handler
 */
export async function getUserAnalyticsData(
  userId: string,
  days: number = 30
): Promise<UserAnalytics> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  return await processUserAnalytics(userId, days);
}
