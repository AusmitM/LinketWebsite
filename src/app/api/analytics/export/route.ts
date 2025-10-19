import "server-only";
import { NextRequest } from "next/server";
import { stringify } from "csv-stringify/sync";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  // TODO: Replace with real session getter
  const session = { user: { id: "mock-user-id" } };
  if (!session || !session.user?.id) return new Response("Unauthorized", { status: 401 });

  const u = new URL(req.url);
  const from = u.searchParams.get("from") ?? new Date(Date.now()-30*864e5).toISOString();
  const to   = u.searchParams.get("to") ?? new Date().toISOString();
  const gran = u.searchParams.get("gran") === "day" ? "day" : "hour";

  const { data, error } = await supabaseAdmin.rpc("owner_tag_rollups", { p_user_id: session.user.id, p_from: from, p_to: to, p_gran: gran });
  if (error) return new Response("Error", { status: 500 });

  const csv = stringify(data, { header: true });
  return new Response(csv, {
    headers: {
      "Content-Type":"text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="linket-analytics_${from.slice(0,10)}_${to.slice(0,10)}.csv"`,
      "Cache-Control":"no-store",
    },
  });
}
