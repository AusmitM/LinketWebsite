import "server-only";

type ForwardPayload = {
  message: string;
  name?: string | null;
  stack?: string | null;
  source?: string | null;
  componentStack?: string | null;
  level?: "error" | "warning";
  href?: string | null;
  userAgent?: string | null;
  timestamp?: string | null;
};

type ParsedDsn = {
  storeUrl: string;
};

function parseSentryDsn(raw: string): ParsedDsn | null {
  try {
    const parsed = new URL(raw);
    const projectId = parsed.pathname.replace(/^\/+/, "");
    const publicKey = parsed.username;
    if (!projectId || !publicKey) return null;
    const origin = `${parsed.protocol}//${parsed.host}`;
    const storeUrl = `${origin}/api/${projectId}/store/?sentry_version=7&sentry_key=${encodeURIComponent(publicKey)}`;
    return { storeUrl };
  } catch {
    return null;
  }
}

function eventId() {
  const alphabet = "abcdef0123456789";
  let value = "";
  for (let i = 0; i < 32; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

export async function forwardClientErrorToSentry(payload: ForwardPayload) {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return { forwarded: false as const, reason: "missing_dsn" as const };
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return { forwarded: false as const, reason: "invalid_dsn" as const };

  const body = {
    event_id: eventId(),
    platform: "javascript",
    level: payload.level === "warning" ? "warning" : "error",
    message: payload.message,
    logger: "linket.client",
    culprit: payload.source || undefined,
    timestamp: payload.timestamp || new Date().toISOString(),
    request: {
      url: payload.href || undefined,
      headers: payload.userAgent
        ? {
            "user-agent": payload.userAgent,
          }
        : undefined,
    },
    exception: {
      values: [
        {
          type: payload.name || "Error",
          value: payload.message,
          stacktrace: payload.stack
            ? {
                frames: [
                  {
                    filename: payload.source || "<unknown>",
                    function: "client",
                    in_app: true,
                    vars: {
                      stack: payload.stack,
                      componentStack: payload.componentStack || "",
                    },
                  },
                ],
              }
            : undefined,
        },
      ],
    },
    tags: {
      source: "client",
      app: "linket",
    },
    extra: {
      componentStack: payload.componentStack || undefined,
    },
  };

  const response = await fetch(parsed.storeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Sentry forward failed (${response.status}): ${text.slice(0, 240)}`);
  }
  return { forwarded: true as const };
}
