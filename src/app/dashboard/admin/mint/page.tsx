import { redirect } from "next/navigation";
import { getCurrentUserWithAdmin } from "@/lib/admin";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import MintControls from "@/components/dashboard/admin/MintControls";
import { Button } from "@/components/ui/button";

type BatchSummary = {
  id: string;
  label: string | null;
  createdAt: string;
  totalTags: number;
};

async function fetchRecentBatches(): Promise<{
  batches: BatchSummary[];
  error: string | null;
}> {
  if (!isSupabaseAdminAvailable) {
    return {
      batches: [],
      error: "Supabase admin credentials are not configured.",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("hardware_tag_batches")
    .select("id,label,created_at,hardware_tags(count)")
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("Failed to load hardware_tag_batches", {
      message: error.message,
      hint: error.hint,
      details: error.details,
      code: error.code,
    });
    return {
      batches: [],
      error: error.message || "Unable to load mint batches.",
    };
  }

  type RawBatchRow = {
    id: string;
    label: string | null;
    created_at: string;
    hardware_tags: Array<{ count: number | null }> | null;
  };

  return {
    batches:
      data?.map((row: RawBatchRow) => {
        const count = Array.isArray(row.hardware_tags)
          ? Number(row.hardware_tags[0]?.count ?? 0)
          : 0;
        return {
          id: row.id,
          label: row.label,
          createdAt: row.created_at,
          totalTags: Number.isFinite(count) ? count : 0,
        };
      }) ?? [],
    error: null,
  };
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

  const { batches, error: batchesError } = await fetchRecentBatches();
  const todayLabel = new Date().toISOString().slice(0, 10);
  const totalBatches = batches.length;
  const totalTags = batches.reduce((sum, batch) => sum + batch.totalTags, 0);
  const latestBatch = batches[0] ?? null;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
          Admin console
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Mint Linkets</h1>
        <p className="text-sm text-muted-foreground">
          Generate claim codes and batch metadata for new Linket tags. Only admins can access this workspace.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <MintControls defaultQty={100} defaultLabel={todayLabel} />
        <div className="space-y-6">
          {batchesError ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <div className="font-semibold">Mint data unavailable</div>
              <p className="mt-1 text-xs">
                {batchesError} Ensure the `hardware_tag_batches` table and minting
                functions have been applied in this Supabase project.
              </p>
            </section>
          ) : null}
          <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Minting checklist</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>Confirm the quantity and label before generating.</li>
              <li>Download and store the CSV in your fulfillment vault.</li>
              <li>Use the claim code display for printing or packaging.</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-border/60 bg-card/80 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Batch overview</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Total batches</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{totalBatches}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Total tags</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {totalTags.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest batch</div>
              <div className="mt-2 text-base font-semibold text-foreground">
                {latestBatch?.label?.trim() || "No batches yet"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {latestBatch ? formatTimestamp(latestBatch.createdAt) : "Create your first batch above."}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/80 p-6 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">Recent batches</h2>
          <p className="text-xs text-muted-foreground">Last 25 batches minted from this console.</p>
        </div>
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Master log</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Single CSV with every Linket ever minted across all batches.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <a href="/api/admin/mint/master-log">Download master CSV</a>
          </Button>
        </div>
        <div className="mt-4 grid gap-3">
          {batches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
              No batches minted yet.
            </div>
          ) : (
            batches.map((batch) => {
              const label = batch.label?.trim() || "Untitled batch";
              const downloadHref = `/api/admin/mint/batch/${batch.id}`;
              return (
                <a
                  key={batch.id}
                  href={downloadHref}
                  className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-background/80"
                  aria-label={`Download CSV for ${label}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTimestamp(batch.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Tags</div>
                    <div className="text-base font-semibold text-foreground">
                      {batch.totalTags.toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      Download CSV
                    </div>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
