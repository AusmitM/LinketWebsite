import "server-only";

import { NextResponse } from "next/server";
import { headers as readRequestHeaders } from "next/headers";
import type { User } from "@supabase/supabase-js";

import {
  evaluateRouteAccess,
  PRIVILEGED_ROUTE_POLICIES,
  type ActorRole,
  type PrivilegedRouteId,
} from "@/lib/api-authorization-policy";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import {
  readBearerTokenFromHeaders,
  verifySupabaseAccessToken,
} from "@/lib/supabase/auth-token";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

type RouteAccessSuccess = {
  isAdmin: boolean;
  role: Exclude<ActorRole, "anonymous">;
  user: User;
};

type AuthenticatedActorResult =
  | {
      authError: null;
      authType: "bearer" | "session";
      user: User;
    }
  | {
      authError: "invalid_token";
      authType: "bearer";
      user: null;
    }
  | {
      authError: null;
      authType: null;
      user: null;
    };

async function isAdminUser(userId: string) {
  const adminLookupClient = isSupabaseAdminAvailable
    ? supabaseAdmin
    : await createServerSupabaseReadonly();
  const { data, error } = await adminLookupClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);

  return !error && Array.isArray(data) && data.length > 0;
}

async function getAuthenticatedActor(): Promise<AuthenticatedActorResult> {
  const requestHeaders = await readRequestHeaders();
  const bearerToken = readBearerTokenFromHeaders(requestHeaders);
  if (bearerToken) {
    const verified = await verifySupabaseAccessToken(bearerToken);
    if (!verified.user) {
      return {
        authError: "invalid_token",
        authType: "bearer",
        user: null,
      };
    }
    return {
      authError: null,
      authType: "bearer",
      user: verified.user,
    };
  }

  const supabase = await createServerSupabaseReadonly();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      authError: null,
      authType: null,
      user: null,
    };
  }

  return {
    authError: null,
    authType: "session",
    user,
  };
}

export async function requireRouteAccess(
  routeId: PrivilegedRouteId,
  options?: {
    resourceUserId?: string | null;
  }
): Promise<NextResponse | RouteAccessSuccess> {
  const actor = await getAuthenticatedActor();
  if (!actor.user) {
    const decision = evaluateRouteAccess({
      actorRole: "anonymous",
      routeId,
      resourceUserId: options?.resourceUserId ?? null,
    });
    return NextResponse.json(
      {
        error:
          actor.authError === "invalid_token"
            ? "Invalid bearer token."
            : decision.status === 401
              ? "Unauthorized"
              : "Forbidden",
      },
      { status: decision.status }
    );
  }

  const needsAdminLookup = PRIVILEGED_ROUTE_POLICIES[routeId] === "admin";
  const isAdmin = needsAdminLookup ? await isAdminUser(actor.user.id) : false;
  const role: ActorRole = isAdmin ? "admin" : "user";
  const decision = evaluateRouteAccess({
    actorRole: role,
    actorUserId: actor.user.id,
    resourceUserId: options?.resourceUserId ?? null,
    routeId,
  });

  if (!decision.allowed) {
    return NextResponse.json(
      { error: decision.status === 401 ? "Unauthorized" : "Forbidden" },
      { status: decision.status }
    );
  }

  return {
    user: actor.user,
    isAdmin,
    role,
  };
}
