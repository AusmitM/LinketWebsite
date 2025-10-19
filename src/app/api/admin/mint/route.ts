import "server-only";
import { NextRequest } from "next/server";
import { stringify } from "csv-stringify/sync";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: adminMatch, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError) {
    console.error("admin check failed", adminError);
    return new Response("Admin check failed", { status: 500 });
  }

  if (!adminMatch) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const qty = Math.min(Math.max(parseInt(url.searchParams.get("qty") ?? "0", 10), 1), 20000);
  const label = url.searchParams.get("label") ?? new Date().toISOString().slice(0,10);

  if (!isSupabaseAdminAvailable) {
    console.error("mint_linkets_csv: supabase admin client missing credentials");
    return new Response("Server credentials missing. Ask an administrator to configure the service role key.", {
      status: 500,
    });
  }

  const { data, error } = await supabaseAdmin.rpc("mint_linkets_csv", { p_qty: qty, p_batch_label: label });
  if (error) {
    console.error("mint_linkets_csv failed", error);
    const message =
      typeof error.message === "string" && error.message.trim().length > 0
        ? error.message
        : "Mint error";
    return new Response(message, { status: 500 });
  }

  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    batch_id: r.batch_id,
    batch_label: r.batch_label,
    public_token: r.public_token,
    url: r.url,
    claim_code_display: r.claim_code_display,
    claim_code: r.claim_code
  }));

  const csv = stringify(rows, { header: true });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="linkets_${label.replace(/\s+/g,'_')}_${qty}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
