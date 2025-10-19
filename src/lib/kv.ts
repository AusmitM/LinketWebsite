import { Redis } from "@upstash/redis";

type MemoryValue<T = unknown> = {
  value: T;
  expiresAt?: number;
};

const memoryStore = new Map<string, MemoryValue>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redisConfigured = Boolean(redisUrl && redisToken);

export const kv = redisConfigured ? new Redis({ url: redisUrl!, token: redisToken! }) : null;

if (!kv && process.env.NODE_ENV !== "production") {
  console.warn("Upstash Redis environment variables are missing; falling back to in-memory cache.");
}

function isExpired(record?: MemoryValue) {
  return record?.expiresAt !== undefined && record.expiresAt <= Date.now();
}

function ensureMemoryRecord(key: string) {
  const record = memoryStore.get(key);
  if (!record || isExpired(record)) {
    memoryStore.delete(key);
    return undefined;
  }
  return record;
}

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  if (kv) {
    return kv.get<T>(key);
  }
  const record = ensureMemoryRecord(key);
  return (record?.value as T) ?? null;
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<"OK" | number> {
  if (kv) {
    return ttlSeconds
      ? (kv.set(key, value, { ex: ttlSeconds }) as Promise<"OK" | number>)
      : (kv.set(key, value) as Promise<"OK" | number>);
  }
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
  memoryStore.set(key, { value, expiresAt });
  return "OK";
}

export async function kvDel(key: string): Promise<number> {
  if (kv) {
    return kv.del(key);
  }
  const existed = ensureMemoryRecord(key) !== undefined;
  memoryStore.delete(key);
  return existed ? 1 : 0;
}

export async function kvIncr(key: string): Promise<number> {
  if (kv) {
    return kv.incr(key);
  }
  const record = ensureMemoryRecord(key);
  const current = (record?.value as number | undefined) ?? 0;
  const next = current + 1;
  memoryStore.set(key, { value: next, expiresAt: record?.expiresAt });
  return next;
}

export async function kvExpire(key: string, ttlSeconds: number): Promise<number> {
  if (kv) {
    return kv.expire(key, ttlSeconds);
  }
  const record = ensureMemoryRecord(key);
  if (!record) {
    return 0;
  }
  record.expiresAt = Date.now() + ttlSeconds * 1000;
  memoryStore.set(key, record);
  return 1;
}
