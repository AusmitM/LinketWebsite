import { CSRF_HEADER_NAME } from "@/lib/csrf";

export type DeploymentEnvironment =
  | "development"
  | "production"
  | "staging";

type CorsConfig = {
  allowCredentials: boolean;
  allowedHeaders: string[];
  allowedMethods: string[];
  allowedOrigins: "*" | string[];
  enabled: boolean;
  environment: DeploymentEnvironment;
};

function parseBooleanEnv(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

function parseListEnv(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function parseAllowedOrigins(value: string | undefined): "*" | string[] {
  const entries = parseListEnv(value);
  if (entries.length === 1 && entries[0] === "*") {
    return "*";
  }
  return entries;
}

function normalizeOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getDeploymentEnvironment(): DeploymentEnvironment {
  const explicit =
    process.env.APP_ENV?.trim().toLowerCase() ??
    process.env.VERCEL_ENV?.trim().toLowerCase() ??
    "";

  if (explicit === "production") {
    return "production";
  }
  if (explicit === "preview" || explicit === "staging") {
    return "staging";
  }
  if (process.env.NODE_ENV === "production") {
    return "production";
  }
  return "development";
}

function getConfiguredOriginValue(environment: DeploymentEnvironment) {
  const specificKey =
    environment === "production"
      ? process.env.CORS_ALLOWED_ORIGINS_PRODUCTION
      : environment === "staging"
        ? process.env.CORS_ALLOWED_ORIGINS_STAGING
        : process.env.CORS_ALLOWED_ORIGINS_DEVELOPMENT;

  return specificKey?.trim()
    ? specificKey
    : process.env.CORS_ALLOWED_ORIGINS?.trim() ?? "";
}

export function getCorsConfig(): CorsConfig {
  const environment = getDeploymentEnvironment();
  const configuredOrigins = parseAllowedOrigins(
    getConfiguredOriginValue(environment)
  );

  return {
    enabled:
      configuredOrigins === "*" ||
      (Array.isArray(configuredOrigins) && configuredOrigins.length > 0),
    allowedOrigins: configuredOrigins,
    allowCredentials: parseBooleanEnv(process.env.CORS_ALLOW_CREDENTIALS),
    allowedHeaders:
      parseListEnv(process.env.CORS_ALLOWED_HEADERS).length > 0
        ? parseListEnv(process.env.CORS_ALLOWED_HEADERS)
        : [
            "Authorization",
            "Content-Type",
            CSRF_HEADER_NAME,
            "X-Requested-With",
          ],
    allowedMethods:
      parseListEnv(process.env.CORS_ALLOWED_METHODS).length > 0
        ? parseListEnv(process.env.CORS_ALLOWED_METHODS)
        : ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    environment,
  };
}

export function assertSafeCorsConfig() {
  const config = getCorsConfig();
  if (config.environment !== "production") {
    return config;
  }

  if (!config.enabled) {
    return config;
  }

  if (config.allowedOrigins === "*") {
    throw new Error(
      "Unsafe CORS configuration: wildcard origins are forbidden in production."
    );
  }

  if (config.allowCredentials && config.allowedOrigins.includes("*")) {
    throw new Error(
      "Unsafe CORS configuration: credentialed requests require explicit origins."
    );
  }

  if (config.allowedOrigins.length === 0) {
    throw new Error(
      "Unsafe CORS configuration: production CORS must use an explicit allowlist."
    );
  }

  return config;
}

export function isCrossOriginRequest(
  requestOrigin: string | null,
  requestUrlOrigin: string
) {
  const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedRequestOrigin) {
    return false;
  }
  return normalizedRequestOrigin !== normalizeOrigin(requestUrlOrigin);
}

export function isOriginAllowed(requestOrigin: string | null) {
  const normalizedOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedOrigin) {
    return false;
  }

  const config = getCorsConfig();
  if (!config.enabled) {
    return false;
  }

  if (config.allowedOrigins === "*") {
    return !config.allowCredentials;
  }

  return config.allowedOrigins.includes(normalizedOrigin);
}

export function resolveCorsHeaders(
  requestOrigin: string | null,
  options?: {
    allowHeaders?: string[];
    allowMethods?: string[];
  }
) {
  const normalizedOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedOrigin) {
    return null;
  }

  const config = getCorsConfig();
  if (!config.enabled) {
    return null;
  }

  if (config.allowedOrigins === "*" && config.allowCredentials) {
    return null;
  }

  const allowOrigin =
    config.allowedOrigins === "*"
      ? "*"
      : config.allowedOrigins.includes(normalizedOrigin)
        ? normalizedOrigin
        : null;

  if (!allowOrigin) {
    return null;
  }

  const allowedHeaders = Array.from(
    new Set([...(options?.allowHeaders ?? []), ...config.allowedHeaders])
  );
  const allowedMethods = Array.from(
    new Set(
      [...(options?.allowMethods ?? []), ...config.allowedMethods].map(
        (method) => method.toUpperCase()
      )
    )
  );

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowedHeaders.join(", "),
    "Access-Control-Allow-Methods": allowedMethods.join(", "),
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
  };

  if (config.allowCredentials) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}
