// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

const options = { db: { schema: "public" } } as const;

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  );
