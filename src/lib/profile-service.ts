//profile-service.ts

/**
```sql
create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  handle text not null,
  headline text,
  header_image_url text,
  header_image_updated_at timestamptz,
  logo_url text,
  logo_updated_at timestamptz,
  logo_shape text,
  logo_bg_white boolean default false,
  theme text not null default 'autumn',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_handle_unique unique (user_id, handle)
);

create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  url text not null,
  order_index int not null default 0,
  is_active boolean not null default true,
  click_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

alter table public.user_profiles enable row level security;
alter table public.profile_links enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'user_profiles_owner_all'
  ) then
    create policy user_profiles_owner_all on public.user_profiles
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_links' and policyname = 'profile_links_owner_all'
  ) then
    create policy profile_links_owner_all on public.profile_links
      for all
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- read-only access for anonymous viewers (public profile)
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'user_profiles_public_select'
  ) then
    create policy user_profiles_public_select on public.user_profiles
      for select using (is_active = true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profile_links' and policyname = 'profile_links_public_select'
  ) then
    create policy profile_links_public_select on public.profile_links
      for select using (is_active = true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.user_profiles to authenticated;
grant select on table public.user_profiles to anon;
grant select, insert, update, delete on table public.profile_links to authenticated;
grant select on table public.profile_links to anon;
```
*/

import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { createClient } from "@supabase/supabase-js";
import type { ThemeName } from "@/lib/themes";
import type { ProfileLinkRecord, UserProfileRecord } from "@/types/db";

const SUPABASE_ENABLED = isSupabaseAdminAvailable;
const PUBLIC_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const PUBLIC_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_PUBLIC_ENABLED = Boolean(
  PUBLIC_URL &&
    PUBLIC_URL !== "https://example.supabase.co" &&
    PUBLIC_ANON_KEY &&
    PUBLIC_ANON_KEY !== "anon-key"
);

const supabasePublic = createClient(
  PUBLIC_URL || "https://example.supabase.co",
  PUBLIC_ANON_KEY || "anon-key",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

const PROFILE_TABLE = "user_profiles";
const PROFILE_LINKS_TABLE = "profile_links";

export class HandleConflictError extends Error {
  suggestions: string[];
  constructor(suggestions: string[]) {
    super("Handle already taken");
    this.name = "HandleConflictError";
    this.suggestions = suggestions;
  }
}

export function isHandleConflictError(error: unknown): error is HandleConflictError {
  return Boolean(error && typeof error === "object" && "name" in error && (error as { name?: string }).name === "HandleConflictError");
}

export type ProfileWithLinks = UserProfileRecord & {
  links: ProfileLinkRecord[];
};

export type ProfilePayload = {
  id?: string;
  name: string;
  handle: string;
  headline?: string | null;
  headerImageUrl?: string | null;
  headerImageUpdatedAt?: string | null;
  logoUrl?: string | null;
  logoUpdatedAt?: string | null;
  logoShape?: "circle" | "rect" | null;
  logoBackgroundWhite?: boolean | null;
  theme: ThemeName;
  links: Array<{ id?: string; title: string; url: string }>;
  active?: boolean;
};

function normaliseHandle(handle: string) {
  return handle.trim().toLowerCase();
}

function normaliseTheme(
  theme: string | ThemeName | null | undefined
): ThemeName {
  const allowed: ThemeName[] = [
    "light",
    "dark",
    "midnight",
    "dream",
    "forest",
    "gilded",
    "ember",
    "autumn",
    "honey",
  ];
  const value = (theme ?? "autumn").toLowerCase();
  return allowed.includes(value as ThemeName) ? (value as ThemeName) : "light";
}

const memoryProfiles = new Map<string, ProfileWithLinks[]>();

export type AccountRecord = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_updated_at: string | null;
};

const memoryAccounts = new Map<string, AccountRecord>();

function cloneAccount(record: AccountRecord): AccountRecord {
  return { ...record };
}

function generateMemoryHandle(
  userId: string,
  preferred?: string | null
): string {
  const base = normaliseHandle(preferred || "");
  const seed = base || `user-${userId.slice(0, 8) || randomId().slice(0, 8)}`;
  let candidate = seed;
  let counter = 1;
  const existing = new Set(
    Array.from(memoryAccounts.values()).map((record) => record.username)
  );
  while (existing.has(candidate)) {
    candidate = `${seed}-${counter++}`;
  }
  return candidate;
}

function ensureMemoryAccountRecord(
  userId: string,
  fallbackHandle?: string | null,
  displayName?: string | null
): AccountRecord {
  const existing = memoryAccounts.get(userId);
  if (existing) {
    if (displayName && !existing.display_name) {
      memoryAccounts.set(userId, { ...existing, display_name: displayName });
      return memoryAccounts.get(userId)!;
    }
    return existing;
  }
  const username = generateMemoryHandle(userId, fallbackHandle);
  const record: AccountRecord = {
    user_id: userId,
    username,
    display_name: displayName ?? null,
    avatar_url: null,
    avatar_updated_at: null,
  };
  memoryAccounts.set(userId, record);
  return record;
}

function memoryGetAccountByHandle(handle: string): AccountRecord | null {
  const target = normaliseHandle(handle);
  for (const record of memoryAccounts.values()) {
    if (record.username === target) {
      return cloneAccount(record);
    }
  }
  return null;
}

function memoryRememberAccount(record: AccountRecord): AccountRecord {
  const normalized = normaliseHandle(record.username);
  const stored: AccountRecord = {
    user_id: record.user_id,
    username: normalized,
    display_name: record.display_name ?? null,
    avatar_url: record.avatar_url ?? null,
    avatar_updated_at: record.avatar_updated_at ?? null,
  };
  memoryAccounts.set(record.user_id, stored);
  return cloneAccount(stored);
}

function cloneDeep<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function randomId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

function isUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

function buildHandleSuggestions(base: string, existing: Set<string>): string[] {
  const suggestions: string[] = [];
  const seed = base || "user";
  for (let i = 1; i <= 50 && suggestions.length < 3; i += 1) {
    const candidate = `${seed}-${i}`;
    if (!existing.has(candidate)) {
      suggestions.push(candidate);
    }
  }
  return suggestions;
}

async function assertHandleAvailable(
  userId: string,
  handle: string,
  profileId?: string | null
) {
  if (!SUPABASE_ENABLED) {
    const existing = memoryGetProfileByHandle(handle);
    if (existing && existing.id !== profileId) {
      const taken = new Set(
        Array.from(memoryProfiles.values()).flatMap((profiles) =>
          profiles.map((profile) => profile.handle)
        )
      );
      throw new HandleConflictError(buildHandleSuggestions(handle, taken));
    }
    return;
  }

  const { data, error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select("id")
    .eq("handle", handle)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (data && (data as { id?: string }).id !== profileId) {
    const { data: similar } = await supabaseAdmin
      .from(PROFILE_TABLE)
      .select("handle")
      .like("handle", `${handle}%`)
      .limit(25);
    const taken = new Set(
      (similar ?? [])
        .map((row) => (row as { handle?: string | null }).handle)
        .filter((value): value is string => Boolean(value))
    );
    taken.add(handle);
    throw new HandleConflictError(buildHandleSuggestions(handle, taken));
  }
}

function ensureMemoryProfiles(userId: string): ProfileWithLinks[] {
  let profiles = memoryProfiles.get(userId);
  if (!profiles) {
    profiles = [];
    memoryProfiles.set(userId, profiles);
  }
  return profiles;
}

function memoryFetchProfileById(profileId: string): ProfileWithLinks | null {
  for (const profiles of memoryProfiles.values()) {
    const match = profiles.find((profile) => profile.id === profileId);
    if (match) return cloneDeep(match);
  }
  return null;
}

function memoryGetProfiles(userId: string): ProfileWithLinks[] {
  const profiles = ensureMemoryProfiles(userId);
  return profiles
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((profile) => cloneDeep(profile));
}

function memoryEnsureSingleActiveProfile(
  userId: string,
  desiredActiveProfileId: string
) {
  const profiles = ensureMemoryProfiles(userId);
  let found = false;
  const now = new Date().toISOString();
  for (const profile of profiles) {
    if (profile.id === desiredActiveProfileId) {
      profile.is_active = true;
      profile.updated_at = now;
      found = true;
    } else {
      profile.is_active = false;
    }
  }
  if (!found) throw new Error("Profile not found");
}

function memoryEnsureHasActiveProfile(userId: string) {
  const profiles = ensureMemoryProfiles(userId);
  if (profiles.length === 0) return;
  if (!profiles.some((profile) => profile.is_active)) {
    profiles[0].is_active = true;
    profiles[0].updated_at = new Date().toISOString();
  }
}

function memorySaveProfileForUser(
  userId: string,
  payload: ProfilePayload
): ProfileWithLinks {
  const handle = normaliseHandle(payload.handle);
  const theme = normaliseTheme(payload.theme);
  const headline = payload.headline?.trim() || null;
  const headerImageUrl = payload.headerImageUrl ?? null;
  const headerImageUpdatedAt = payload.headerImageUpdatedAt ?? null;
  const logoUrl = payload.logoUrl ?? null;
  const logoUpdatedAt = payload.logoUpdatedAt ?? null;
  const logoShape = payload.logoShape ?? "circle";
  const logoBackgroundWhite = payload.logoBackgroundWhite ?? false;
  const links = payload.links ?? [];
  const name = payload.name?.trim();
  if (!name) throw new Error("Profile name is required");
  if (!handle) throw new Error("Handle is required");
  const existing = memoryGetProfileByHandle(handle);
  if (existing && existing.id !== payload.id) {
    const taken = new Set(
      Array.from(memoryProfiles.values()).flatMap((profiles) =>
        profiles.map((profile) => profile.handle)
      )
    );
    throw new HandleConflictError(buildHandleSuggestions(handle, taken));
  }

  const profiles = ensureMemoryProfiles(userId);
  const now = new Date().toISOString();

  let profile = payload.id
    ? profiles.find((p) => p.id === payload.id)
    : undefined;

  if (!profile) {
    profile = {
      id: randomId(),
      user_id: userId,
      name,
      handle,
      headline,
      header_image_url: payload.headerImageUrl ?? null,
      header_image_updated_at: payload.headerImageUpdatedAt ?? null,
      logo_url: logoUrl,
      logo_updated_at: logoUpdatedAt,
      logo_shape: logoShape,
      logo_bg_white: logoBackgroundWhite,
      theme,
      is_active: false,
      created_at: now,
      updated_at: now,
      links: [],
    };
    profiles.push(profile);
  } else {
    profile.name = name;
    profile.handle = handle;
    profile.headline = headline;
    profile.theme = theme;
    if (payload.headerImageUrl !== undefined) {
      profile.header_image_url = payload.headerImageUrl;
    }
    if (payload.headerImageUpdatedAt !== undefined) {
      profile.header_image_updated_at = payload.headerImageUpdatedAt;
    }
    if (payload.logoUrl !== undefined) {
      profile.logo_url = payload.logoUrl ?? null;
    }
    if (payload.logoUpdatedAt !== undefined) {
      profile.logo_updated_at = payload.logoUpdatedAt ?? null;
    }
    if (payload.logoShape !== undefined) {
      profile.logo_shape = payload.logoShape ?? "circle";
    }
    if (payload.logoBackgroundWhite !== undefined) {
      profile.logo_bg_white = payload.logoBackgroundWhite ?? false;
    }
    profile.updated_at = now;
  }

  const existingLinks = new Map(profile.links.map((link) => [link.id, link]));
  profile.links = links.map((link, index) => {
    const existing = link.id ? existingLinks.get(link.id) : undefined;
    const id = existing?.id || link.id || randomId();
    const createdAt = existing?.created_at || now;
    return {
      id,
      profile_id: profile!.id,
      user_id: userId,
      title: link.title?.trim() || `Link ${index + 1}`,
      url: link.url?.trim() || "",
      order_index: index,
      is_active: existing?.is_active ?? true,
      click_count: existing?.click_count ?? 0,
      created_at: createdAt,
      updated_at: now,
    };
  });

  ensureMemoryAccountRecord(userId, profile.handle, profile.name);

  if (payload.active) {
    memoryEnsureSingleActiveProfile(userId, profile.id);
  } else {
    if (!profiles.some((p) => p.is_active)) {
      profile.is_active = true;
    }
  }

  memoryEnsureHasActiveProfile(userId);
  return cloneDeep(profile);
}

function memoryDeleteProfileForUser(userId: string, profileId: string) {
  const profiles = ensureMemoryProfiles(userId);
  const index = profiles.findIndex((profile) => profile.id === profileId);
  if (index === -1) return;
  profiles.splice(index, 1);
  memoryEnsureHasActiveProfile(userId);
}

function memorySetActiveProfileForUser(
  userId: string,
  profileId: string
): ProfileWithLinks {
  memoryEnsureSingleActiveProfile(userId, profileId);
  const profile = ensureMemoryProfiles(userId).find((p) => p.id === profileId);
  if (!profile) throw new Error("Profile not found");
  return cloneDeep(profile);
}

function memoryGetProfileByHandle(handle: string): ProfileWithLinks | null {
  const target = normaliseHandle(handle);
  for (const profiles of memoryProfiles.values()) {
    const match = profiles.find((profile) => profile.handle === target);
    if (match) return cloneDeep(match);
  }
  return null;
}

function memoryGetActiveProfileForUser(
  userId: string
): ProfileWithLinks | null {
  const profiles = ensureMemoryProfiles(userId);
  const match = profiles.find((profile) => profile.is_active);
  return match ? cloneDeep(match) : null;
}

function memoryGetGlobalActiveProfile(): ProfileWithLinks | null {
  let candidate: ProfileWithLinks | null = null;
  for (const profiles of memoryProfiles.values()) {
    for (const profile of profiles) {
      if (!profile.is_active) continue;
      const currentScore = Date.parse(profile.updated_at || profile.created_at);
      const candidateScore = candidate
        ? Date.parse(candidate.updated_at || candidate.created_at)
        : Number.NEGATIVE_INFINITY;
      if (!candidate || currentScore > candidateScore) {
        candidate = profile;
      }
    }
  }
  return candidate ? cloneDeep(candidate) : null;
}

async function fetchProfileWithLinksById(
  profileId: string
): Promise<ProfileWithLinks | null> {
  if (!SUPABASE_ENABLED) {
    return memoryFetchProfileById(profileId);
  }
  const { data, error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select(`*, links:${PROFILE_LINKS_TABLE}(*)`)
    .eq("id", profileId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const profile = data as unknown as UserProfileRecord & {
    links: ProfileLinkRecord[];
  };
  return { ...profile, links: (profile.links ?? []).sort(byOrder) };
}

function byOrder(a: ProfileLinkRecord, b: ProfileLinkRecord) {
  return (
    (a.order_index ?? 0) - (b.order_index ?? 0) ||
    a.created_at.localeCompare(b.created_at)
  );
}

export async function getProfilesForUser(
  userId: string
): Promise<ProfileWithLinks[]> {
  if (!userId) throw new Error("userId is required");
  if (!SUPABASE_ENABLED) {
    return memoryGetProfiles(userId);
  }
  const { data, error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select(`*, links:${PROFILE_LINKS_TABLE}(*)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const records = (data ?? []) as Array<
    UserProfileRecord & { links: ProfileLinkRecord[] }
  >;
  return records.map((profile) => ({
    ...profile,
    links: (profile.links ?? []).sort(byOrder),
  }));
}

async function ensureSingleActiveProfile(
  userId: string,
  desiredActiveProfileId: string
) {
  if (!SUPABASE_ENABLED) {
    memoryEnsureSingleActiveProfile(userId, desiredActiveProfileId);
    return;
  }
  const { error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .update({ is_active: false })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const { error: activateErr } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", desiredActiveProfileId)
    .eq("user_id", userId);
  if (activateErr) throw new Error(activateErr.message);
}

async function ensureHasActiveProfile(userId: string) {
  if (!SUPABASE_ENABLED) {
    memoryEnsureHasActiveProfile(userId);
    return;
  }
  const { data, error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (data) return;
  const { data: first, error: firstErr } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (firstErr) throw new Error(firstErr.message);
  if (first?.id) {
    await ensureSingleActiveProfile(userId, first.id);
  }
}

export async function saveProfileForUser(
  userId: string,
  payload: ProfilePayload
): Promise<ProfileWithLinks> {
  if (!userId) throw new Error("userId is required");
  const handle = normaliseHandle(payload.handle);
  if (!SUPABASE_ENABLED) {
    return memorySaveProfileForUser(userId, payload);
  }
  const theme = normaliseTheme(payload.theme);
  const headline = payload.headline?.trim() || null;
  const headerImageUrl = payload.headerImageUrl ?? null;
  const headerImageUpdatedAt = payload.headerImageUpdatedAt ?? null;
  const logoUrl = payload.logoUrl ?? null;
  const logoUpdatedAt = payload.logoUpdatedAt ?? null;
  const logoShape = payload.logoShape ?? "circle";
  const logoBackgroundWhite = payload.logoBackgroundWhite ?? false;
  const links = payload.links ?? [];
  const name = payload.name?.trim();
  if (!name) throw new Error("Profile name is required");
  if (!handle) throw new Error("Handle is required");

  let profileId = payload.id ?? null;

  await assertHandleAvailable(userId, handle, profileId);

  if (!profileId) {
    const { data, error } = await supabaseAdmin
      .from(PROFILE_TABLE)
      .insert({
        user_id: userId,
        name,
        handle,
        headline,
        header_image_url: headerImageUrl,
        header_image_updated_at: headerImageUpdatedAt,
        logo_url: logoUrl,
        logo_updated_at: logoUpdatedAt,
        logo_shape: logoShape,
        logo_bg_white: logoBackgroundWhite,
        theme,
        is_active: false,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    profileId = (data as UserProfileRecord).id;
  } else {
    const updatePayload: Record<string, unknown> = {
      name,
      handle,
      headline,
      theme,
      updated_at: new Date().toISOString(),
    };
    if (payload.headerImageUrl !== undefined) {
      updatePayload.header_image_url = payload.headerImageUrl;
    }
    if (payload.headerImageUpdatedAt !== undefined) {
      updatePayload.header_image_updated_at = payload.headerImageUpdatedAt;
    }
    if (payload.logoUrl !== undefined) {
      updatePayload.logo_url = payload.logoUrl;
    }
    if (payload.logoUpdatedAt !== undefined) {
      updatePayload.logo_updated_at = payload.logoUpdatedAt;
    }
    if (payload.logoShape !== undefined) {
      updatePayload.logo_shape = payload.logoShape;
    }
    if (payload.logoBackgroundWhite !== undefined) {
      updatePayload.logo_bg_white = payload.logoBackgroundWhite;
    }
    const { error } = await supabaseAdmin
      .from(PROFILE_TABLE)
      .update(updatePayload)
      .eq("id", profileId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }

  const { data: existingLinks, error: existingErr } = await supabaseAdmin
    .from(PROFILE_LINKS_TABLE)
    .select("id")
    .eq("profile_id", profileId);
  if (existingErr) throw new Error(existingErr.message);

  const indexedLinks = links.map((link, index) => ({
    ...link,
    order_index: index,
  }));
  const incomingIds = new Set(
    indexedLinks.filter((link) => isUuid(link.id)).map((link) => link.id!)
  );
  const idsToDelete = (existingLinks ?? [])
    .map((row) => row.id as string)
    .filter((id) => !incomingIds.has(id));

  if (idsToDelete.length) {
    const { error: deleteErr } = await supabaseAdmin
      .from(PROFILE_LINKS_TABLE)
      .delete()
      .in("id", idsToDelete);
    if (deleteErr) throw new Error(deleteErr.message);
  }

  const upsertLinks = indexedLinks
    .filter((link) => isUuid(link.id))
    .map((link) => ({
      id: link.id!,
      profile_id: profileId!,
      user_id: userId,
      title: link.title?.trim() || "Link",
      url: link.url?.trim() || "https://",
      order_index: link.order_index,
      is_active: true,
    }));

  if (upsertLinks.length) {
    const { error: upsertErr } = await supabaseAdmin
      .from(PROFILE_LINKS_TABLE)
      .upsert(upsertLinks, { onConflict: "id" });
    if (upsertErr) throw new Error(upsertErr.message);
  }

  const newLinks = indexedLinks.filter((link) => !isUuid(link.id));
  if (newLinks.length) {
    const formatted = newLinks.map((link) => ({
      profile_id: profileId!,
      user_id: userId,
      title: link.title?.trim() || "Link",
      url: link.url?.trim() || "https://",
      order_index: link.order_index,
      is_active: true,
    }));
    const { error: insertErr } = await supabaseAdmin
      .from(PROFILE_LINKS_TABLE)
      .insert(formatted);
    if (insertErr) throw new Error(insertErr.message);
  }

  if (payload.active) {
    await ensureSingleActiveProfile(userId, profileId!);
  } else {
    await ensureHasActiveProfile(userId);
  }

  const profile = await fetchProfileWithLinksById(profileId!);
  if (!profile) throw new Error("Profile not found after save");
  return profile;
}

export async function deleteProfileForUser(
  userId: string,
  profileId: string
): Promise<void> {
  if (!userId || !profileId)
    throw new Error("userId and profileId are required");
  if (!SUPABASE_ENABLED) {
    memoryDeleteProfileForUser(userId, profileId);
    return;
  }
  const { error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .delete()
    .eq("id", profileId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  await ensureHasActiveProfile(userId);
}

export async function setActiveProfileForUser(
  userId: string,
  profileId: string
): Promise<ProfileWithLinks> {
  if (!SUPABASE_ENABLED) {
    return memorySetActiveProfileForUser(userId, profileId);
  }
  await ensureSingleActiveProfile(userId, profileId);
  const profile = await fetchProfileWithLinksById(profileId);
  if (!profile) throw new Error("Profile not found");
  return profile;
}

export async function getProfileByHandle(
  handle: string
): Promise<ProfileWithLinks | null> {
  const normalised = normaliseHandle(handle);
  if (!SUPABASE_ENABLED) {
    return getProfileByHandlePublic(normalised);
  }
  try {
    const { data, error } = await supabaseAdmin
      .from(PROFILE_TABLE)
      .select(`*, links:${PROFILE_LINKS_TABLE}(*)`)
      .eq("handle", normalised)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    if (data) {
      const record = data as unknown as UserProfileRecord & {
        links: ProfileLinkRecord[];
      };
      return { ...record, links: (record.links ?? []).sort(byOrder) };
    }
  } catch (error) {
    console.error("Profile handle admin lookup failed:", error);
  }
  return getProfileByHandlePublic(normalised);
}

async function getProfileByHandlePublic(
  normalised: string
): Promise<ProfileWithLinks | null> {
  if (!SUPABASE_PUBLIC_ENABLED) {
    return memoryGetProfileByHandle(normalised);
  }
  const { data, error } = await supabasePublic
    .from(PROFILE_TABLE)
    .select(`*, links:${PROFILE_LINKS_TABLE}(*)`)
    .eq("handle", normalised)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (!data) return null;
  const record = data as unknown as UserProfileRecord & {
    links: ProfileLinkRecord[];
  };
  return { ...record, links: (record.links ?? []).sort(byOrder) };
}

export async function getActiveProfileForUser(
  userId: string
): Promise<ProfileWithLinks | null> {
  if (!SUPABASE_ENABLED) {
    return memoryGetActiveProfileForUser(userId);
  }
  const { data, error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select(`*, links:${PROFILE_LINKS_TABLE}(*)`)
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (!data) return null;
  const record = data as unknown as UserProfileRecord & {
    links: ProfileLinkRecord[];
  };
  return { ...record, links: (record.links ?? []).sort(byOrder) };
}

export async function getGlobalActiveProfile(): Promise<ProfileWithLinks | null> {
  if (!SUPABASE_ENABLED) {
    return memoryGetGlobalActiveProfile();
  }
  const { data, error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select(`*, links:${PROFILE_LINKS_TABLE}(*)`)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (!data) return null;
  const record = data as unknown as UserProfileRecord & {
    links: ProfileLinkRecord[];
  };
  return { ...record, links: (record.links ?? []).sort(byOrder) };
}

export async function getAccountHandleForUser(
  userId: string
): Promise<string | null> {
  if (!userId) throw new Error("userId is required");
  if (!SUPABASE_ENABLED) {
    return ensureMemoryAccountRecord(userId).username;
  }
  const { data, error } = await supabaseAdmin
    .from(PROFILE_TABLE)
    .select("handle")
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  const handle = data?.handle
    ? normaliseHandle(data.handle as string)
    : "";
  return handle || `user-${userId.slice(0, 8)}`;
}

export async function getAccountByHandle(
  handle: string
): Promise<AccountRecord | null> {
  const normalised = normaliseHandle(handle);
  if (!normalised) return null;
  if (!SUPABASE_ENABLED) {
    return memoryGetAccountByHandle(normalised);
  }
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("user_id, username, display_name, avatar_url, updated_at")
    .eq("username", normalised)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw new Error(error.message);
  if (!data) {
    return memoryGetAccountByHandle(normalised);
  }
  const usernameRaw = (data.username as string | null) ?? null;
  const username = normaliseHandle(usernameRaw || normalised);
  const record: AccountRecord = {
    user_id: data.user_id as string,
    username,
    display_name: (data.display_name as string | null) ?? null,
    avatar_url: (data.avatar_url as string | null) ?? null,
    avatar_updated_at: (data.updated_at as string | null) ?? null,
  };
  return memoryRememberAccount(record);
}

export async function getActiveProfileForPublicHandle(
  handle: string
): Promise<{ account: AccountRecord; profile: ProfileWithLinks } | null> {
  const normalised = normaliseHandle(handle);
  const profile = await getProfileByHandle(normalised);
  if (!profile) return null;
  let account: AccountRecord = {
    user_id: profile.user_id,
    username: normalised,
    display_name: profile.name ?? null,
    avatar_url: null,
    avatar_updated_at: null,
  };

  if (SUPABASE_ENABLED) {
    try {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("user_id, username, display_name, avatar_url, updated_at")
        .eq("user_id", profile.user_id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      if (data) {
        account = {
          user_id: data.user_id as string,
          username: (data.username as string | null) ?? normalised,
          display_name:
            (data.display_name as string | null) ?? profile.name ?? null,
          avatar_url: (data.avatar_url as string | null) ?? null,
          avatar_updated_at: (data.updated_at as string | null) ?? null,
        };
        memoryRememberAccount(account);
      }
    } catch (error) {
      console.error("Public account lookup failed:", error);
    }
  }

  return { account, profile };
}
