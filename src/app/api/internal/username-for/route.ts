import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest){
  if (req.headers.get("x-internal-secret") !== process.env.INTERNAL_SECRET)
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid) return NextResponse.json({}, { status: 400 });

  const { data } = await supabaseAdmin.from("profiles").select("username").eq("user_id", uid).single();
  return NextResponse.json({ username: data?.username ?? "user" });
}
