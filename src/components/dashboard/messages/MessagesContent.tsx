"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const LEADS: Lead[] = [
  {
    id: "lead-1",
    name: "Maya Chen",
    email: "maya.chen@example.com",
    source: "Campus Fair tap",
    addedAt: "2h ago",
    company: "UT Austin",
    location: "Austin, TX",
    messages: [
      { id: "m-1", author: "Maya", body: "Loved the keychain demo. Can we chat about pricing for 200 units?", sentAt: "10:12 AM" },
      { id: "m-2", author: "You", body: "Thanks for stopping by! I'll send a bulk quote shortly.", sentAt: "10:20 AM" },
    ],
  },
  {
    id: "lead-2",
    name: "Leo Martinez",
    email: "leo@creatorhub.co",
    source: "Newsletter form",
    addedAt: "Yesterday",
    company: "Creator Hub",
    location: "Brooklyn, NY",
    messages: [
      { id: "m-3", author: "Leo", body: "Looking to embed the Linket profile in my LinkTree.", sentAt: "4:45 PM" },
    ],
  },
  {
    id: "lead-3",
    name: "Coastal Coffee",
    email: "hello@coastal.cafe",
    source: "QR flyer",
    addedAt: "Aug 8",
    company: "Coastal Coffee",
    location: "San Diego, CA",
    messages: [
      { id: "m-4", author: "Coastal team", body: "Do you support store-level analytics if we roll out 12 tags?", sentAt: "Aug 8" },
    ],
  },
];

type Lead = {
  id: string;
  name: string;
  email: string;
  source: string;
  company: string;
  location: string;
  addedAt: string;
  messages: Array<{ id: string; author: string; body: string; sentAt: string }>;
};

export default function MessagesContent() {
  const [selectedId, setSelectedId] = useState<string>(LEADS[0]?.id ?? "");
  const [query, setQuery] = useState("");

  const filteredLeads = useMemo(() => {
    if (!query.trim()) return LEADS;
    const terms = query.trim().toLowerCase().split(/\s+/);
    return LEADS.filter((lead) =>
      terms.every((term) =>
        [lead.name, lead.company, lead.location, lead.source]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term))
      )
    );
  }, [query]);

  const selected = useMemo(() => {
    if (filteredLeads.length === 0) return undefined;
    const targetId = filteredLeads.some((lead) => lead.id === selectedId) ? selectedId : filteredLeads[0].id;
    return filteredLeads.find((lead) => lead.id === targetId) ?? filteredLeads[0];
  }, [filteredLeads, selectedId]);

  const csv = useMemo(() => {
    const header = "Name,Email,Company,Location,Source,Added At";
    const rows = filteredLeads.map((lead) =>
      [lead.name, lead.email, lead.company, lead.location, lead.source, lead.addedAt]
        .map(escapeCsv)
        .join(",")
    );
    return [header, ...rows].join("\r\n");
  }, [filteredLeads]);

  function onDownloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "linket-leads.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 lg:space-y-0 lg:gap-6 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Leads</CardTitle>
            <p className="text-sm text-muted-foreground">Captured from tap journeys and contact forms.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Input
              placeholder="Search name, company, school, location"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="sm:min-w-[240px]"
            />
            <Button variant="outline" size="sm" className="rounded-full" onClick={onDownloadCsv} disabled={filteredLeads.length === 0}>
              Download CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-2">
            {filteredLeads.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                No leads match your search.
              </p>
            ) : (
              filteredLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left transition ${lead.id === selected?.id ? "border-[var(--primary)] bg-[var(--primary)]/10" : "hover:border-[var(--primary)]/40"}`}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{lead.addedAt}</span>
                    <span>{lead.source}</span>
                  </div>
                  <div className="text-sm font-semibold text-foreground">{lead.name}</div>
                  <p className="truncate text-xs text-muted-foreground">{[lead.company, lead.location].filter(Boolean).join(" \u00B7 ")}</p>
                </button>
              ))
            )}
          </div>
          {selected ? (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-background p-4">
                <div className="text-sm font-semibold text-foreground">{selected.name}</div>
                <p className="text-xs text-muted-foreground">{selected.email}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="rounded-full text-[10px]">{selected.company}</Badge>
                  <Badge variant="secondary" className="rounded-full text-[10px]">{selected.location}</Badge>
                  <Badge variant="secondary" className="rounded-full text-[10px]">{selected.source}</Badge>
                </div>
              </div>
              <Card className="rounded-2xl border bg-card/60">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Messages</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {selected.messages.length === 0 ? (
                    <p className="text-muted-foreground">No messages yet.</p>
                  ) : (
                    selected.messages.map((message) => (
                      <div key={message.id} className="rounded-xl border bg-background px-3 py-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{message.author}</span>
                          <span>{message.sentAt}</span>
                        </div>
                        <p className="mt-1 text-foreground">{message.body}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-3xl border bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Email integrations (coming soon)</CardTitle>
          <p className="text-sm text-muted-foreground">Connect Gmail or other inboxes to reply without leaving Linket.</p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          We will surface integrations here so you can sync conversations, trigger follow-ups, and keep lead history in one place.
        </CardContent>
      </Card>
    </div>
  );
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}




























