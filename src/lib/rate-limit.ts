import { kvIncr, kvExpire } from "./kv";
import { hashIp } from "@/lib/security";

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "0.0.0.0"
  );
}

export async function limitHit(key:string, limit=10, windowMs=60_000){
  const bucket = `rl:${key}:${Math.floor(Date.now()/windowMs)}`;
  const count = await kvIncr(bucket);
  if (count === 1) await kvExpire(bucket, Math.ceil(windowMs/1000));
  return count > limit;
}

export async function limitRequest(
  req: Request,
  prefix: string,
  limit = 10,
  windowMs = 60_000
) {
  const ip = getClientIp(req);
  const token = await hashIp(ip);
  return limitHit(`${prefix}:${token}`, limit, windowMs);
}
