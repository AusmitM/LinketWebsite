"use client";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let passwordResetClient:
  | ReturnType<typeof createSupabaseClient>
  | null = null;

export function createPasswordResetClient() {
  if (passwordResetClient) {
    return passwordResetClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  passwordResetClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    db: { schema: "public" },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return passwordResetClient;
}
