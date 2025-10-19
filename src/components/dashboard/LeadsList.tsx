"use client";

/**
See SQL definition inside `src/components/public/PublicLeadForm.tsx` for the `public.leads` table and RLS policies.
*/

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/system/toaster";
import type { Lead } from "@/types/db";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export default function LeadsList({ userId }: { userId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [q, setQ] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;
  const offsetRef = useRef(0);

  const like = useMemo(() => q.trim(), [q]);

  async function load({ reset = false }: { reset?: boolean } = {}) {
    if (!userId) return;
    if (reset) { setLoading(true); offsetRef.current = 0; }
    else setFetching(true);
    const query = supabase
      .from("leads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offsetRef.current, offsetRef.current + pageSize - 1);

    if (like) {
      // Search across name, email, company, message
      // Supabase `or` filter syntax
      const pat = `%${like}%`;
      query.or(
        [
          `name.ilike.${pat}`,
          `email.ilike.${pat}`,
          `company.ilike.${pat}`,
          `message.ilike.${pat}`,
        ].join(",")
      );
    }

    const { data, error } = await query;
    if (error) {
      if (reset) setLeads([]);
      toast({ title: "Leads unavailable", description: error.message, variant: "destructive" });
    } else {
      const rows = (data as Lead[]) || [];
      if (reset) setLeads(rows);
      else setLeads((prev) => dedupeById([...prev, ...rows]));
      setHasMore(rows.length === pageSize);
      offsetRef.current += rows.length;
    }
    if (reset) setLoading(false); else setFetching(false);
  }

  useEffect(() => {
    if (userId) load({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Re-run on search term
  useEffect(() => {
    const t = setTimeout(() => load({ reset: true }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [like]);

  // Live updates via Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`leads-owner-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads', filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<Lead>) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Lead;
            setLeads((prev) => dedupeById([row, ...prev]));
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Lead;
            setLeads((prev) => prev.map((x) => (x.id === row.id ? row : x)));
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as Lead;
            setLeads((prev) => prev.filter((x) => x.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  function dedupeById(list: Lead[]): Lead[] {
    const seen = new Set<string>();
    const out: Lead[] = [];
    for (const item of list) {
      if (!seen.has(item.id)) { out.push(item); seen.add(item.id); }
    }
    return out;
  }

  async function onDelete(id: string) {
    const ok = confirm("Delete this lead? This cannot be undone.");
    if (!ok) return;
    const { error } = await supabase.from("leads").delete().eq("id", id).eq("user_id", userId);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else toast({ title: "Lead deleted", variant: "success" });
  }

  function exportCsv() {
    if (leads.length === 0) {
      toast({ title: "No leads to export" });
      return;
    }
    const header = ["created_at","name","email","phone","company","message","source_url","handle","id"]; 
    const rows = leads.map((l) => [
      safeCsv(l.created_at),
      safeCsv(l.name),
      safeCsv(l.email),
      safeCsv(l.phone || ""),
      safeCsv(l.company || ""),
      safeCsv(l.message || ""),
      safeCsv(l.source_url || ""),
      safeCsv(l.handle),
      safeCsv(l.id),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.download = `leads-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function safeCsv(s: string) {
    // Quote if needed and escape quotes
    if (s == null) return "";
    const needs = /[",\n]/.test(s);
    const val = String(s).replace(/"/g, '""');
    return needs ? `"${val}"` : val;
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); toast({ title: "Copied" }); }
    catch { toast({ title: "Could not copy", variant: "destructive" }); }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="font-display">Leads</CardTitle>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, company, message"
            className="rounded-xl"
            aria-label="Search leads"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => load({ reset: true })} disabled={fetching} aria-label="Refresh leads">
              {fetching || loading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} aria-label="Export CSV">Export</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border p-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-sm text-muted-foreground">No leads yet. Share your public page to collect contacts.</div>
        ) : (
          <div className="space-y-3">
            {leads.map((l) => (
              <article key={l.id} className="rounded-xl border p-4 shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium">
                      {l.name}
                      {l.company ? <span className="text-muted-foreground"> · {l.company}</span> : null}
                    </h3>
                    <p className="text-xs text-muted-foreground break-all">{l.email}{l.phone ? ` · ${l.phone}` : ""}</p>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={l.created_at}>{new Date(l.created_at).toLocaleString()}</time>
                </header>
                {l.message ? <p className="mt-2 text-sm whitespace-pre-wrap">{l.message}</p> : null}
                <footer className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <a
                    className="rounded-md border px-2 py-1 hover:bg-muted"
                    href={`mailto:${encodeURIComponent(l.email)}?subject=${encodeURIComponent(`Re: ${l.name}`)}`}
                    aria-label="Reply via email"
                  >Reply</a>
                  <Button variant="outline" size="sm" onClick={() => copy(l.email)} aria-label="Copy email">Copy email</Button>
                  {l.source_url ? (
                    <a className="rounded-md border px-2 py-1 hover:bg-muted" href={l.source_url} target="_blank" rel="noreferrer" aria-label="Open source URL">Source</a>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={() => onDelete(l.id)} aria-label="Delete lead">Delete</Button>
                </footer>
              </article>
            ))}
            {hasMore && (
              <div className="pt-2">
                <Button onClick={() => load()} disabled={fetching} aria-label="Load more leads">{fetching ? "Loading…" : "Load more"}</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
