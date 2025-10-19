import { kvIncr, kvExpire } from "./kv";
export async function limitHit(key:string, limit=10, windowMs=60_000){
  const bucket = `rl:${key}:${Math.floor(Date.now()/windowMs)}`;
  const count = await kvIncr(bucket);
  if (count === 1) await kvExpire(bucket, Math.ceil(windowMs/1000));
  return count > limit;
}
