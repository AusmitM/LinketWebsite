import { kvGet, kvSet } from "@/lib/kv";
import { sanitizeHttpUrl, parseDevice, hostOnly, hashIp } from "@/lib/security";

type TagCache = {
  id: string;
  status: string;
  owner_id: string | null;
  target_type: "profile" | "url";
  target_url?: string | null;
  target_profile_slug?: string | null;
};

export async function kvGetTag(token: string): Promise<TagCache | null> {
  const key = `hw:${token}`;
  let cached = await kvGet<TagCache>(key);
  if (cached) return cached;

  const res = await fetch(`/api/internal/linket-lookup?token=${encodeURIComponent(token)}`, {
    headers: { "x-internal-secret": process.env.INTERNAL_SECRET! },
    cache: "no-store",
  });
  if (!res.ok) return null;
  cached = await res.json();
  await kvSet(key, cached, 60);
  return cached;
}

export async function resolveTarget(lk: TagCache): Promise<string> {
  if (lk.target_type === "url" && lk.target_url) return sanitizeHttpUrl(lk.target_url);
  if (lk.owner_id) {
    const r = await fetch(`/api/internal/username-for?uid=${lk.owner_id}`, {
      headers: { "x-internal-secret": process.env.INTERNAL_SECRET! },
      cache: "no-store",
    });
    const { username } = await r.json();
    return lk.target_profile_slug ? `/${username}/${lk.target_profile_slug}` : `/${username}`;
  }
  return "/registration";
}

export async function recordEvent(tagId: string, type: "scan"|"vcard_dl"|"lead_submit"|"contact_click"|"claim"|"target_change"|"transfer", req: Request) {
  const h = Object.fromEntries(new Headers(req.headers).entries());
  const ip = h["x-forwarded-for"]?.split(",")[0]?.trim() ?? h["x-real-ip"];
  const payload = {
    tag_id: tagId,
    event_type: type,
    country: h["x-vercel-ip-country"] ?? h["cf-ipcountry"] ?? "-",
    device: parseDevice(h["user-agent"] ?? ""),
    referrer: hostOnly(h["referer"] ?? ""),
    utm: {},
    ip_hash: await hashIp(ip),
  };
  await fetch("/api/internal/log-event", {
    method: "POST",
    headers: { "content-type":"application/json", "x-internal-secret": process.env.INTERNAL_SECRET! },
    body: JSON.stringify(payload),
  }).catch(()=>{});
}
