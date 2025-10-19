import { NextRequest, NextResponse } from "next/server";
import { sanitizeHttpUrl } from "@/lib/security";

export async function GET(req: NextRequest){
  const u = new URL(req.url);
  const to = u.searchParams.get("to") ?? "/";
  let safe = "/";
  try { safe = sanitizeHttpUrl(to); } catch {}
  const tid = req.cookies.get("lc_tid")?.value;
  if (tid) {
    fetch("/api/internal/log-event", {
      method:"POST", headers:{ "content-type":"application/json","x-internal-secret":process.env.INTERNAL_SECRET! },
      body: JSON.stringify({ tag_id: tid, event_type: "contact_click" })
    }).catch(()=>{});
  }
  return NextResponse.redirect(safe, 302);
}
