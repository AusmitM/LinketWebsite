import "server-only";

import type { User } from "@supabase/supabase-js";

import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

export function normalizeUserEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}

export async function findAuthUserByEmail(
  email: string
): Promise<User | null> {
  if (!isSupabaseAdminAvailable) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  const targetEmail = normalizeUserEmail(email);
  if (!targetEmail) return null;

  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(error.message);
    }

    const users = data?.users ?? [];
    const match =
      users.find(
        (user) => normalizeUserEmail(user.email) === targetEmail
      ) ?? null;

    if (match) return match;

    if (!data?.nextPage || users.length === 0) {
      return null;
    }

    page = data.nextPage;
  }
}
