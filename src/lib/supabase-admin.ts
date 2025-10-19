// src/lib/supabase-admin.ts
// Server-only Supabase client using the service role key
// Used for privileged operations like looking up user email by ID

import "server-only";
import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseAdminAvailable = Boolean(
  rawUrl &&
    rawUrl !== "https://example.supabase.co" &&
    rawServiceKey &&
    rawServiceKey !== "service-role-key"
);

const url = rawUrl || "https://example.supabase.co";
const service = rawServiceKey || "service-role-key";

export const supabaseAdmin = createClient(url, service, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
// No changes needed; file is correct and server-only.
