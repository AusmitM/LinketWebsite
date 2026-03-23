import "server-only";

import { normalizeLeadFormConfig } from "@/lib/lead-form";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import type { LeadFormConfig } from "@/types/lead-form";

type ReadonlySupabase = Awaited<ReturnType<typeof createServerSupabaseReadonly>>;

type LeadFormRow = {
  id: string;
  profile_id: string | null;
  handle: string | null;
  status: "draft" | "published";
  config: LeadFormConfig | null;
  updated_at: string | null;
};

export type PublicLeadFormLookup = {
  handle?: string | null;
  profileId?: string | null;
  supabase?: ReadonlySupabase;
};

export type PublicLeadFormResult = {
  row: LeadFormRow | null;
  form: LeadFormConfig | null;
  formId: string | null;
};

async function fetchPublishedLeadFormByProfileId(
  supabase: ReadonlySupabase,
  profileId: string
) {
  const { data, error } = await supabase
    .from("lead_forms")
    .select("id, profile_id, handle, status, config, updated_at")
    .eq("profile_id", profileId)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return (data as LeadFormRow | null) ?? null;
}

async function fetchPublishedLeadFormByHandle(
  supabase: ReadonlySupabase,
  handle: string
) {
  const { data, error } = await supabase
    .from("lead_forms")
    .select("id, profile_id, handle, status, config, updated_at")
    .eq("handle", handle)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message);
  }

  return (data as LeadFormRow | null) ?? null;
}

export async function getPublishedLeadForm({
  handle,
  profileId,
  supabase,
}: PublicLeadFormLookup): Promise<PublicLeadFormResult> {
  const client = supabase ?? (await createServerSupabaseReadonly());
  const normalizedHandle = handle?.trim().toLowerCase() || null;
  const normalizedProfileId = profileId?.trim() || null;

  let row = normalizedProfileId
    ? await fetchPublishedLeadFormByProfileId(client, normalizedProfileId)
    : null;

  if ((!row || !row.config) && normalizedHandle) {
    row = await fetchPublishedLeadFormByHandle(client, normalizedHandle);
  }

  if (!row?.config) {
    return {
      row,
      form: null,
      formId: row?.id ?? null,
    };
  }

  return {
    row,
    form: normalizeLeadFormConfig(row.config, row.id),
    formId: row.id,
  };
}
