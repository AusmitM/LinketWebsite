export const runtime = "edge";
import { NextResponse } from "next/server";
import { kvGetTag, resolveTarget, recordEvent } from "@/lib/redirector";

export async function GET(req: Request, context: { params: Promise<{ token: string }> }) {
  const params = await context.params;
  const tag = await kvGetTag(params.token);
  if (!tag) return NextResponse.redirect(new URL("/404", req.url), 302);

  if (tag.status === "unclaimed" || tag.status === "claimable")
    return NextResponse.redirect(new URL(`/registration?token=${params.token}`, req.url), 302);
  if (tag.status === "lost")
    return NextResponse.redirect(new URL(`/safety?token=${params.token}`, req.url), 302);
  if (["suspended","archived","retired"].includes(tag.status))
    return NextResponse.redirect(new URL(`/suspended`, req.url), 302);

  let target = "/invalid-target";
  try { target = await resolveTarget(tag); } catch {}
  const res = NextResponse.redirect(new URL(target, req.url), 302);
  res.headers.set("Set-Cookie", `lc_tid=${tag.id}; Path=/; Max-Age=1800; SameSite=Lax; Secure`);
  recordEvent(tag.id, "scan", req).catch(()=>{});
  return res;
}
