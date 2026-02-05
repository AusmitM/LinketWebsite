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
import { normalizeLeadFormConfig } from "@/lib/lead-form";
import { Download, RefreshCw, Trash2, XCircle } from "lucide-react";
import type { Lead } from "@/types/db";
import type { LeadFormConfig } from "@/types/lead-form";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export default function LeadsList({ userId }: { userId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [fieldLabels, setFieldLabels] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [q, setQ] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 20;
  const offsetRef = useRef(0);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const like = useMemo(() => q.trim(), [q]);
  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedIds.has(lead.id)),
    [leads, selectedIds]
  );
  const allVisibleSelected =
    leads.length > 0 && leads.every((lead) => selectedIds.has(lead.id));
  const someVisibleSelected = selectedIds.size > 0 && !allVisibleSelected;

  async function load({ reset = false }: { reset?: boolean } = {}) {
    if (!userId) return;
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else setFetching(true);
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
      toast({
        title: "Leads unavailable",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const rows = (data as Lead[]) || [];
      if (reset) setLeads(rows);
      else setLeads((prev) => dedupeById([...prev, ...rows]));
      setHasMore(rows.length === pageSize);
      offsetRef.current += rows.length;
    }
    if (reset) setLoading(false);
    else setFetching(false);
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

  // Keep the "select all" checkbox in sync with partial selections.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  // Ensure selection state stays valid when the visible list changes.
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const visibleIds = new Set(leads.map((lead) => lead.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
  }, [leads, selectedIds.size]);

  useEffect(() => {
    const handles = Array.from(new Set(leads.map((lead) => lead.handle).filter(Boolean)));
    if (handles.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("lead_forms")
        .select("handle, config")
        .in("handle", handles)
        .eq("user_id", userId);
      if (error || !data || cancelled) return;
      const next: Record<string, Record<string, string>> = {};
      for (const row of data as Array<{ handle: string | null; config: LeadFormConfig }>) {
        if (!row.handle) continue;
        const handle = row.handle;
        const normalized = normalizeLeadFormConfig(row.config, handle);
        if (!next[handle]) next[handle] = {};
        normalized.fields.forEach((field) => {
          next[handle][field.id] = field.label;
        });
      }
      setFieldLabels((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
  }, [leads, userId]);

  // Live updates via Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`leads-owner-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads",
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Lead>) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Lead;
            setLeads((prev) => dedupeById([row, ...prev]));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Lead;
            setLeads((prev) => prev.map((x) => (x.id === row.id ? row : x)));
          } else if (payload.eventType === "DELETE") {
            const row = payload.old as Lead;
            setLeads((prev) => prev.filter((x) => x.id !== row.id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function dedupeById(list: Lead[]): Lead[] {
    const seen = new Set<string>();
    const out: Lead[] = [];
    for (const item of list) {
      if (!seen.has(item.id)) {
        out.push(item);
        seen.add(item.id);
      }
    }
    return out;
  }

  // Toggle a single lead selection on/off.
  function toggleLeadSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Select or clear all currently visible leads.
  function toggleSelectAll() {
    if (leads.length === 0) return;
    setSelectedIds(() => {
      if (allVisibleSelected) return new Set();
      return new Set(leads.map((lead) => lead.id));
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function onDelete(id: string) {
    const ok = confirm("Delete this lead? This cannot be undone.");
    if (!ok) return;
    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error)
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    else {
      setLeads((prev) => prev.filter((lead) => lead.id !== id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast({ title: "Lead deleted", variant: "success" });
    }
  }

  // Export CSV for a given list of leads (defaults to all leads).
  function exportCsv(targetLeads: Lead[] = leads) {
    if (targetLeads.length === 0) {
      toast({ title: "No leads to export" });
      return;
    }
    const customKeySet = new Set<string>();
    const labelByKey: Record<string, string> = {};
    targetLeads.forEach((lead) => {
      const custom = lead.custom_fields;
      if (!custom || typeof custom !== "object") return;
      Object.entries(custom).forEach(([key, value]) => {
        if (!key || isCoreFieldKey(key)) return;
        if (value == null) return;
        if (value === "" || (typeof value === "string" && !value.trim())) return;
        const parsed = parseCustomFieldKey(key);
        customKeySet.add(key);
        if (!labelByKey[key]) {
          labelByKey[key] =
            parsed.label ||
            fieldLabels[lead.handle]?.[parsed.id] ||
            toReadableLabel(parsed.id);
        }
      });
    });
    const customKeys = Array.from(customKeySet);
    const usedHeaders = new Set<string>();
    const customHeaders = customKeys.map((key) => {
      const label = labelByKey[key] || toReadableLabel(key);
      if (usedHeaders.has(label)) {
        const deduped = `${label} (${key})`;
        usedHeaders.add(deduped);
        return deduped;
      }
      usedHeaders.add(label);
      return label;
    });
    const header = [
      "created_at",
      "name",
      "email",
      "phone",
      "company",
      "message",
      "handle",
      ...customHeaders,
    ];
    const rows = targetLeads.map((l) => [
      safeCsv(l.created_at),
      safeCsv(l.name),
      safeCsv(l.email),
      safeCsv(l.phone || ""),
      safeCsv(l.company || ""),
      safeCsv(l.message || ""),
      safeCsv(l.handle),
      ...customKeys.map((key) => {
        const value = l.custom_fields?.[key] as string | boolean | null | undefined;
        return safeCsv(formatLeadValue(value ?? null));
      }),
    ]);
    const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.download = `leads-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // Remove all selected leads in one action.
  async function onDeleteSelected() {
    if (selectedIds.size === 0) return;
    const ok = confirm(`Delete ${selectedIds.size} lead(s)? This cannot be undone.`);
    if (!ok) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("leads")
      .delete()
      .in("id", ids)
      .eq("user_id", userId);
    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setLeads((prev) => prev.filter((lead) => !selectedIds.has(lead.id)));
    clearSelection();
    toast({ title: "Leads deleted", variant: "success" });
  }

  function safeCsv(s: string) {
    // Quote if needed and escape quotes
    if (s == null) return "";
    const needs = /[",\n]/.test(s);
    const val = String(s).replace(/"/g, '""');
    return needs ? `"${val}"` : val;
  }

  function escapeVCardValue(value: string) {
    return value
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  }

  function buildVCard(lead: Lead) {
    const name = (lead.name || "").trim();
    const nameParts = name.split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
    const middleName =
      nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : "";
    const noteParts: string[] = [];
    if (lead.message) noteParts.push(lead.message.trim());
    const customFields = formatCustomFieldsForNote(lead);
    if (customFields.length) noteParts.push(customFields.join("\n"));

    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${escapeVCardValue(name || "Linket Contact")}`,
      `N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};${escapeVCardValue(middleName)};;`,
    ];

    if (lead.email) lines.push(`EMAIL;TYPE=INTERNET:${escapeVCardValue(lead.email)}`);
    if (lead.phone) lines.push(`TEL;TYPE=CELL:${escapeVCardValue(lead.phone)}`);
    if (lead.company) lines.push(`ORG:${escapeVCardValue(lead.company)}`);
    if (noteParts.length) lines.push(`NOTE:${escapeVCardValue(noteParts.join("\n"))}`);

    lines.push("END:VCARD");
    return lines.join("\n");
  }

  function downloadVCard(lead: Lead) {
    const vcard = buildVCard(lead);
    const blob = new Blob([vcard], { type: "text/vcard;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const fileNameBase = (lead.name || "linket-contact").trim().replace(/\s+/g, "-");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${fileNameBase || "linket-contact"}.vcf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              size="sm"
              onClick={() => load({ reset: true })}
              disabled={fetching}
              aria-label="Refresh leads"
              className="hidden w-full sm:flex sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4 sm:hidden" aria-hidden />
              {fetching || loading ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCsv()}
              aria-label="Export CSV"
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4 sm:hidden" aria-hidden />
              Export All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk selection toolbar */}
        {leads.length > 0 && (
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 text-foreground shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <label className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/80">
              <span className="relative inline-flex h-6 w-6 items-center justify-center sm:h-5 sm:w-5">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  className="dashboard-leads-checkbox peer h-6 w-6 cursor-pointer appearance-none rounded-md border border-[var(--accent)] bg-background/80 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 checked:border-[var(--accent)] checked:bg-[var(--accent)] sm:h-5 sm:w-5"
                  aria-label="Select all visible leads"
                />
                <span className="pointer-events-none absolute text-xs font-bold text-[var(--accent-foreground)] opacity-0 transition peer-checked:opacity-100">
                  ✓
                </span>
              </span>
              Select all
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-foreground/80">
                {selectedIds.size} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCsv(selectedLeads)}
                disabled={selectedIds.size === 0}
                className="w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4 sm:hidden" aria-hidden />
                Export selected
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteSelected}
                disabled={selectedIds.size === 0}
                className="w-full sm:w-auto"
              >
                <Trash2 className="mr-2 h-4 w-4 sm:hidden" aria-hidden />
                Delete selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={selectedIds.size === 0}
                className="w-full sm:w-auto"
              >
                <XCircle className="mr-2 h-4 w-4 sm:hidden" aria-hidden />
                Clear
              </Button>
            </div>
          </div>
        )}
        {loading ? (
          <div className="dashboard-skeleton space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border p-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" data-skeleton />
                <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" data-skeleton />
              </div>
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No leads yet. Share your public page to collect contacts.
          </div>
        ) : (
          <div className="space-y-2">
            {leads.map((l) => (
              <article
                key={l.id}
                className={`rounded-xl border p-3 shadow-sm transition cursor-pointer ${
                  selectedIds.has(l.id)
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/70 bg-background"
                }`}
                onClick={(event) => {
                  const target = event.target as HTMLElement | null;
                  if (!target) return;
                  if (target.closest("button, a, input, select, textarea, label")) return;
                  toggleLeadSelection(l.id);
                }}
              >
                <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="relative mt-0.5 inline-flex h-6 w-6 items-center justify-center sm:h-5 sm:w-5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(l.id)}
                        onChange={() => toggleLeadSelection(l.id)}
                        className="dashboard-leads-checkbox peer h-6 w-6 cursor-pointer appearance-none rounded-md border border-[var(--accent)] bg-background/80 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 checked:border-[var(--accent)] checked:bg-[var(--accent)] sm:h-5 sm:w-5"
                        aria-label={`Select lead ${l.name || l.email || "entry"}`}
                      />
                      <span className="pointer-events-none absolute text-xs font-bold text-[var(--accent-foreground)] opacity-0 transition peer-checked:opacity-100">
                        ✓
                      </span>
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium">
                        {l.name}
                        {l.company ? (
                          <span className="text-muted-foreground">
                            {" "}
                            - {l.company}
                          </span>
                        ) : null}
                      </h3>
                      {(l.email || l.phone) && (
                        <p className="text-xs text-muted-foreground break-all">
                          {l.email || ""}
                          {l.email && l.phone ? " - " : ""}
                          {l.phone || ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <time
                    className="text-xs text-muted-foreground sm:ml-auto"
                    dateTime={l.created_at}
                  >
                    {new Date(l.created_at).toLocaleString()}
                  </time>
                </header>
                {l.message ? (
                  <p className="mt-2 text-sm whitespace-pre-wrap">
                    {l.message}
                  </p>
                ) : null}
                {renderCustomFields(l, fieldLabels)}
                <footer className="mt-2 flex flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center">
                  {(l.name || l.email || l.phone || l.company || l.message) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadVCard(l)}
                      aria-label="Download contact"
                      className="w-full sm:w-auto"
                    >
                      Download contact
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(l.id)}
                    aria-label="Delete lead"
                    className="flex w-full items-center gap-1 sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </footer>
              </article>
            ))}
            {hasMore && (
              <div className="pt-2">
                <Button
                  onClick={() => load()}
                  disabled={fetching}
                  aria-label="Load more leads"
                  className="w-full sm:w-auto"
                >
                  {fetching ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CORE_FIELD_KEYS = new Set(["name", "email", "phone", "company", "message"]);

function renderCustomFields(lead: Lead, labelsByHandle: Record<string, Record<string, string>>) {
  const custom = lead.custom_fields;
  if (!custom || typeof custom !== "object") return null;
  const entries = Object.entries(custom)
    .filter(([key, value]) => {
      if (!key || isCoreFieldKey(key)) return false;
      if (value === true || value === false) return true;
      if (value == null) return false;
      return String(value).trim().length > 0;
    })
    .map(([key, value]) => {
      const parsed = parseCustomFieldKey(key);
      const label =
        parsed.label ||
        labelsByHandle[lead.handle]?.[parsed.id] ||
        toReadableLabel(parsed.id);
      return { key, label, value: formatLeadValue(value) };
    });

  if (entries.length === 0) return null;

  return (
    <dl className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
      {entries.map((entry) => (
        <div key={entry.key} className="min-w-0">
          <dt className="font-medium text-foreground">{entry.label}</dt>
          <dd className="break-words">{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatCustomFieldsForNote(lead: Lead) {
  const custom = lead.custom_fields;
  if (!custom || typeof custom !== "object") return [];
  return Object.entries(custom)
    .filter(([key, value]) => {
      if (!key || isCoreFieldKey(key)) return false;
      if (value === true || value === false) return true;
      if (value == null) return false;
      return String(value).trim().length > 0;
    })
    .map(([key, value]) => {
      const parsed = parseCustomFieldKey(key);
      const label = parsed.label || toReadableLabel(parsed.id);
      return `${label}: ${formatLeadValue(value)}`;
    });
}

function formatLeadValue(value: string | boolean | null) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (value == null) return "";
  return String(value);
}

function isCoreFieldKey(key: string) {
  const parsed = parseCustomFieldKey(key);
  const candidate = (parsed.label || parsed.id).toLowerCase();
  return CORE_FIELD_KEYS.has(candidate);
}

function parseCustomFieldKey(key: string) {
  const parts = key.split("::");
  if (parts.length < 2) return { id: key, label: null as string | null };
  const id = parts[parts.length - 1]?.trim() || key;
  const label = parts.slice(0, -1).join("::").trim() || null;
  return { id, label };
}

function toReadableLabel(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
