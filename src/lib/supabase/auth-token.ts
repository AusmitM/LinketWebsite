import { createClient, type User } from "@supabase/supabase-js";

type HeaderReader = {
  get(name: string): string | null;
};

let tokenVerifierClient:
  | ReturnType<typeof createClient>
  | null = null;

function getTokenVerifierClient() {
  if (tokenVerifierClient) {
    return tokenVerifierClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  tokenVerifierClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return tokenVerifierClient;
}

export function readBearerTokenFromHeaders(headers: HeaderReader) {
  const authorization = headers.get("authorization")?.trim() ?? "";
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";
  return token || null;
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<{
  error: string | null;
  user: User | null;
}> {
  const client = getTokenVerifierClient();
  if (!client) {
    return {
      error: "Supabase auth token verification is not configured.",
      user: null,
    };
  }

  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    return {
      error: error?.message ?? "Invalid bearer token.",
      user: null,
    };
  }

  return {
    error: null,
    user: data.user,
  };
}
