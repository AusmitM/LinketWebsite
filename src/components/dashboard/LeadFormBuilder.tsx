"use client";

/**
SQL (run in Supabase SQL editor, idempotent):

create extension if not exists pgcrypto;

create table if not exists public.lead_form_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  label text not null,
  type text not null check (type in ('text','email','phone','textarea')),
  required boolean not null default false,
  placeholder text,
  order_index int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lead_form_fields enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='lead_form_fields' and policyname='lead_fields_owner_all'
  ) then
    create policy lead_fields_owner_all on public.lead_form_fields for all
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='lead_form_fields' and policyname='lead_fields_public_select'
  ) then
    create policy lead_fields_public_select on public.lead_form_fields for select using (true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select on table public.lead_form_fields to anon, authenticated;
grant insert, update, delete on table public.lead_form_fields to authenticated;
*/

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { LeadField } from "@/types/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/system/toaster";

type Props = { userId: string; handle: string | null };

export default function LeadFormBuilder({ userId, handle }: Props) {
  const [rows, setRows] = useState<LeadField[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("lead_form_fields")
        .select("*")
        .eq("user_id", userId)
        .order("order_index", { ascending: true });
      if (error) toast({ title: "Lead fields unavailable", description: error.message, variant: "destructive" });
      setRows((data as LeadField[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  async function addField() {
    const payload = {
      user_id: userId,
      handle: handle || "",
      label: "Question",
      type: "text" as const,
      required: false,
      placeholder: "",
      order_index: rows.length,
      is_active: true,
    };
    const { data, error } = await supabase.from("lead_form_fields").insert(payload).select().single();
    if (error) return toast({ title: "Could not add", description: error.message, variant: "destructive" });
    setRows((prev) => [...prev, data as LeadField]);
  }

  async function save(row: LeadField) {
    const { error } = await supabase.from("lead_form_fields").update({
      label: row.label,
      type: row.type,
      required: row.required,
      placeholder: row.placeholder,
      order_index: row.order_index,
      is_active: row.is_active,
    }).eq("id", row.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Saved" });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("lead_form_fields").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function update(id: string, patch: Partial<LeadField>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="font-display">Lead Form</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border p-4">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border p-3 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_12rem_8rem_8rem_auto] md:items-center">
                  <div>
                    <Label>Label</Label>
                    <Input value={r.label} onChange={(e) => update(r.id, { label: e.target.value })} />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={r.type} onValueChange={(v) => update(r.id, { type: v as LeadField["type"] })}>
                      <SelectTrigger><SelectValue placeholder="Field type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">text</SelectItem>
                        <SelectItem value="email">email</SelectItem>
                        <SelectItem value="phone">phone</SelectItem>
                        <SelectItem value="textarea">textarea</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Required</Label>
                    <div className="flex h-10 items-center"><Switch checked={r.required} onCheckedChange={(v) => update(r.id, { required: v })} /></div>
                  </div>
                  <div>
                    <Label>Order</Label>
                    <Input value={r.order_index} onChange={(e) => update(r.id, { order_index: Number(e.target.value)||0 })} />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="outline" onClick={() => save(r)}>Save</Button>
                    <Button variant="ghost" onClick={() => remove(r.id)}>Delete</Button>
                  </div>
                </div>
                <div className="mt-2">
                  <Label>Placeholder</Label>
                  <Input value={r.placeholder || ""} onChange={(e) => update(r.id, { placeholder: e.target.value })} />
                </div>
              </div>
            ))}
            <Button onClick={addField} className="rounded-2xl">Add Question</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
