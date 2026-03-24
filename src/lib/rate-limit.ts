import { kvExpire, kvGet, kvIncr } from "./kv";
import { hashIdentifier } from "@/lib/security";

export type RateLimitScope = "ip" | "user";

export type RateLimitState = {
  allowed: boolean;
  identifier: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  scope: RateLimitScope;
  totalHits: number;
  windowMs: number;
};

type HeaderReader = {
  get(name: string): string | null;
};

type RateLimitProfile = {
  limit: number;
  windowMs: number;
};

type RateLimitConfiguration = {
  authenticatedIp: RateLimitProfile;
  authenticatedUser: RateLimitProfile;
  enabled: boolean;
  publicIp: RateLimitProfile;
  webhookIp: RateLimitProfile;
};

function parseIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getBucketStart(nowMs: number, windowMs: number) {
  return Math.floor(nowMs / windowMs) * windowMs;
}

export function getClientIp(headers: HeaderReader) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-vercel-forwarded-for") ||
    "0.0.0.0"
  );
}

export function getRateLimitConfig(): RateLimitConfiguration {
  return {
    enabled: process.env.RATE_LIMIT_ENABLED?.trim().toLowerCase() !== "false",
    publicIp: {
      limit: parseIntegerEnv("RATE_LIMIT_PUBLIC_MAX_REQUESTS", 100),
      windowMs: parseIntegerEnv("RATE_LIMIT_PUBLIC_WINDOW_MS", 60_000),
    },
    authenticatedIp: {
      limit: parseIntegerEnv("RATE_LIMIT_AUTH_IP_MAX_REQUESTS", 300),
      windowMs: parseIntegerEnv("RATE_LIMIT_AUTH_IP_WINDOW_MS", 60_000),
    },
    authenticatedUser: {
      limit: parseIntegerEnv("RATE_LIMIT_AUTH_USER_MAX_REQUESTS", 180),
      windowMs: parseIntegerEnv("RATE_LIMIT_AUTH_USER_WINDOW_MS", 60_000),
    },
    webhookIp: {
      limit: parseIntegerEnv("RATE_LIMIT_WEBHOOK_MAX_REQUESTS", 300),
      windowMs: parseIntegerEnv("RATE_LIMIT_WEBHOOK_WINDOW_MS", 60_000),
    },
  };
}

export function resolveApiRateLimitProfile(args: {
  isPrivilegedRoute: boolean;
  pathname: string;
}) {
  const config = getRateLimitConfig();

  if (args.pathname === "/api/stripe/webhook") {
    return {
      ip: config.webhookIp,
      user: null,
    };
  }

  if (args.isPrivilegedRoute) {
    return {
      ip: config.authenticatedIp,
      user: config.authenticatedUser,
    };
  }

  return {
    ip: config.publicIp,
    user: null,
  };
}

export async function consumeRateLimit(args: {
  identifier: string;
  limit: number;
  nowMs?: number;
  prefix: string;
  scope: RateLimitScope;
  windowMs: number;
}): Promise<RateLimitState> {
  const nowMs = args.nowMs ?? Date.now();
  const windowStart = getBucketStart(nowMs, args.windowMs);
  const currentWindowId = Math.floor(windowStart / args.windowMs);
  const previousWindowId = currentWindowId - 1;
  const hashedIdentifier = await hashIdentifier(args.identifier);
  const currentKey = `rl:${args.prefix}:${args.scope}:${hashedIdentifier}:${currentWindowId}`;
  const previousKey = `rl:${args.prefix}:${args.scope}:${hashedIdentifier}:${previousWindowId}`;
  const currentCount = await kvIncr(currentKey);

  if (currentCount === 1) {
    await kvExpire(currentKey, Math.ceil(args.windowMs / 1000));
  }

  const previousCount = Number((await kvGet(previousKey)) ?? 0);
  const elapsedMs = nowMs - windowStart;
  const overlapWeight = Math.max(0, (args.windowMs - elapsedMs) / args.windowMs);
  const weightedHits = currentCount + previousCount * overlapWeight;
  const allowed = weightedHits <= args.limit;
  const resetAt = windowStart + args.windowMs;

  return {
    allowed,
    identifier: args.identifier,
    limit: args.limit,
    remaining: Math.max(0, Math.floor(args.limit - weightedHits)),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - nowMs) / 1000)),
    scope: args.scope,
    totalHits: Math.ceil(weightedHits),
    windowMs: args.windowMs,
  };
}

export function summarizeRateLimitStates(states: RateLimitState[]) {
  if (states.length === 0) {
    throw new Error("Cannot summarize an empty rate limit state list.");
  }

  const blockedState = states.find((state) => !state.allowed);
  if (blockedState) {
    return blockedState;
  }

  return states.reduce((selected, candidate) => {
    if (candidate.remaining < selected.remaining) {
      return candidate;
    }
    if (
      candidate.remaining === selected.remaining &&
      candidate.resetAt < selected.resetAt
    ) {
      return candidate;
    }
    return selected;
  });
}

export function buildRateLimitHeaders(
  states: RateLimitState[],
  nowMs = Date.now()
) {
  const summary = summarizeRateLimitStates(states);
  const resetSeconds = Math.max(
    0,
    Math.ceil((summary.resetAt - nowMs) / 1000)
  );
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(summary.limit),
    "RateLimit-Policy": states
      .map((state) => `${state.limit};w=${Math.ceil(state.windowMs / 1000)};scope=${state.scope}`)
      .join(", "),
    "RateLimit-Remaining": String(summary.remaining),
    "RateLimit-Reset": String(resetSeconds),
    "X-RateLimit-Limit": String(summary.limit),
    "X-RateLimit-Remaining": String(summary.remaining),
    "X-RateLimit-Reset": String(resetSeconds),
  };

  if (!summary.allowed) {
    headers["Retry-After"] = String(summary.retryAfterSeconds);
  }

  return headers;
}

export async function evaluateApiRateLimit(args: {
  isPrivilegedRoute: boolean;
  pathname: string;
  request: Request;
  userId?: string | null;
}) {
  const config = getRateLimitConfig();
  if (!config.enabled) {
    return {
      allowed: true,
      headers: {} as Record<string, string>,
      states: [] as RateLimitState[],
    };
  }

  const profile = resolveApiRateLimitProfile({
    isPrivilegedRoute: args.isPrivilegedRoute,
    pathname: args.pathname,
  });
  const states = [
    await consumeRateLimit({
      identifier: getClientIp(args.request.headers),
      limit: profile.ip.limit,
      prefix: args.pathname,
      scope: "ip",
      windowMs: profile.ip.windowMs,
    }),
  ];

  if (args.userId && profile.user) {
    states.push(
      await consumeRateLimit({
        identifier: args.userId,
        limit: profile.user.limit,
        prefix: args.pathname,
        scope: "user",
        windowMs: profile.user.windowMs,
      })
    );
  }

  return {
    allowed: states.every((state) => state.allowed),
    headers: buildRateLimitHeaders(states),
    states,
  };
}

export async function limitRequest(
  req: Request,
  prefix: string,
  limit = 10,
  windowMs = 60_000
) {
  const state = await consumeRateLimit({
    identifier: getClientIp(req.headers),
    limit,
    prefix,
    scope: "ip",
    windowMs,
  });
  return !state.allowed;
}
