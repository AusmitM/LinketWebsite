import { redirect } from "next/navigation";
import { getCurrentUserWithAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import MintControls from "@/components/dashboard/admin/MintControls";

type BatchSummary = {
  id: string;
  label: string | null;
  createdAt: string;
  totalTags: number;
};

async function fetchRecentBatches(): Promise<BatchSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("hardware_tag_batches")
    .select("id,label,created_at,hardware_tags(count)")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("Failed to load hardware_tag_batches", error);
    return [];
  }

  type RawBatchRow = {
    id: string;
    label: string | null;
    created_at: string;
    hardware_tags: Array<{ count: number | null }> | null;
  };

  return (
    data?.map((row: RawBatchRow) => {
      const count = Array.isArray(row.hardware_tags) ? Number(row.hardware_tags[0]?.count ?? 0) : 0;
      return {
        id: row.id,
        label: row.label,
        createdAt: row.created_at,
        totalTags: Number.isFinite(count) ? count : 0,
      };
    }) ?? []
  );
}

function formatTimestamp(value: string) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(dt);
}

export const dynamic = "force-dynamic";

export default async function AdminMintPage() {
  const { user, isAdmin } = await getCurrentUserWithAdmin();
  if (!user) redirect("/auth?view=signin&next=/dashboard/admin/mint");
  if (!isAdmin) redirect("/dashboard");

  const batches = await fetchRecentBatches();
  const todayLabel = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Manufacturing mint</h1>
        <p className="text-sm text-muted-foreground">
          Generate Linket hardware batches and download the CSV for engraving / packaging.
        </p>
      </header>

      <MintControls defaultQty={100} defaultLabel={todayLabel} />

      <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Recent batches</h2>
        <p className="text-xs text-muted-foreground">Last 25 batches minted via this console.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-border/60 text-sm">
            <thead className="text-left">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Batch label</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium text-right">Total tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No batches minted yet.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="align-middle">
                    <td className="px-3 py-2 font-medium text-foreground">{batch.label ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimestamp(batch.createdAt)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{batch.totalTags.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
