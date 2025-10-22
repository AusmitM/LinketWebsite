// src/lib/supabase.ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";

// Be defensive: avoid throwing if env vars are missing in some environments.
// Provide benign placeholders so the app can render and surface friendly errors
// instead of crashing the route error boundary.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

const isBrowser = typeof window !== "undefined";
const clientOptions = { db: { schema: "public" } } as const;

export const supabase = isBrowser
  ? createBrowserClient(url, anon, clientOptions)
  : createSupabaseClient(url, anon, clientOptions);
