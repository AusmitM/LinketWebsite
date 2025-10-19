"use client";

/**
SQL setup (run in Supabase SQL editor):

```sql
create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  handle text not null,
  name text not null,
  email text not null,
  phone text,
  company text,
  message text,
  source_url text,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;

-- Allow anyone to submit a lead
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_anon_insert'
  ) then
    create policy leads_anon_insert on public.leads for insert with check (true);
  end if;
end $$;

-- Only the owner can read/update/delete their leads
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_owner_select'
  ) then
    create policy leads_owner_select on public.leads for select using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_owner_update'
  ) then
    create policy leads_owner_update on public.leads for update using (user_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'leads' and policyname = 'leads_owner_delete'
  ) then
    create policy leads_owner_delete on public.leads for delete using (user_id = auth.uid());
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select on table public.leads to authenticated;
grant insert on table public.leads to anon, authenticated;
grant update, delete on table public.leads to authenticated;
```
*/

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/system/toaster";

type DynamicField = {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea";
  required: boolean;
  placeholder: string | null;
};

type AnswersMap = Record<string, string>;

type Appearance = {
  cardBackground: string;
  cardBorder: string;
  text: string;
  muted: string;
  buttonVariant: "default" | "secondary";
};

type Props = {
  ownerId?: string | null;
  handle: string;
  appearance?: Appearance;
};

export default function PublicLeadForm({ ownerId, handle, appearance }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState("");
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [answers, setAnswers] = useState<AnswersMap>({});

  const disabled = !ownerId;
  const sourceUrl = useMemo(() => {
    try {
      return window?.location?.href ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!ownerId) {
      setFields([]);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("lead_form_fields")
          .select("id,label,type,required,placeholder")
          .eq("user_id", ownerId)
          .eq("is_active", true)
          .order("order_index", { ascending: true });
        if (!error && data) {
          setFields((data as unknown as DynamicField[]) || []);
        }
      } catch {}
    })();
  }, [ownerId]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ownerId) {
      toast({ title: "Unavailable", description: "Owner not found.", variant: "destructive" });
      return;
    }
    if (!name.trim() || !email.trim()) {
      toast({ title: "Missing info", description: "Name and email required.", variant: "destructive" });
      return;
    }
    if (trap.trim().length > 0) {
      toast({ title: "Thanks!", description: "Your details were sent.", variant: "success" });
      resetForm();
      return;
    }
    setLoading(true);
    try {
      const custom = Object.keys(answers).length ? answers : null;
      const serialized = custom ? `\n\n[Form]\n${JSON.stringify(custom)}` : "";
      const payload: Record<string, unknown> = {
        user_id: ownerId,
        handle,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        company: company.trim() || null,
        message: (message.trim() || "") + serialized || null,
        source_url: sourceUrl,
      };
      if (custom) payload.custom_fields = custom;
      const { error } = await supabase.from("leads").insert(payload);
      if (error) {
        const resp = await fetch("/api/leads/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const info = await safeJson(resp);
          const errMsg = (info?.error as string) || (error?.message as string);
          throw new Error(errMsg || "Insert failed");
        }
      }
      fetch("/api/leads/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, honeypot: trap || null }),
      }).catch(() => {});
      resetForm();
      toast({ title: "Thanks!", description: "Your details were sent.", variant: "success" });
    } catch (error) {
      const errObj = error as { message?: string; details?: string; hint?: string } | string | undefined;
      const msg = typeof errObj === "string" ? errObj : errObj?.message || errObj?.details || errObj?.hint || "";
      console.error("lead-submit-failed", error);
      toast({ title: "Could not submit", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setMessage("");
    setTrap("");
    setAnswers({});
  }

  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const cardStyle = appearance
    ? { background: appearance.cardBackground, borderColor: appearance.cardBorder, color: appearance.text }
    : undefined;

  const mutedStyle = appearance ? { color: appearance.muted } : undefined;

  return (
    <Card className="rounded-2xl" style={cardStyle}>
      <CardHeader>
        <CardTitle className="font-display" style={{ color: appearance?.text }}>
          Get in touch
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={onSubmit} aria-label="Contact the owner">
          <div className="hidden" aria-hidden>
            <label htmlFor="lead-website">Website</label>
            <input
              id="lead-website"
              name="website"
              autoComplete="off"
              tabIndex={-1}
              value={trap}
              onChange={(event) => setTrap(event.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="lead-name">Name</Label>
            <Input id="lead-name" value={name} onChange={(event) => setName(event.target.value)} required disabled={disabled} />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={disabled}
            />
          </div>
          {fields.map((field) => (
            <div
              key={field.id}
              className={`space-y-1.5 sm:col-span-1 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
            >
              <Label htmlFor={`custom-${field.id}`}>{field.label}</Label>
              {field.type === "textarea" ? (
                <Textarea
                  id={`custom-${field.id}`}
                  rows={4}
                  placeholder={field.placeholder || ""}
                  value={answers[field.id] || ""}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.value }))}
                  required={field.required}
                  disabled={disabled}
                />
              ) : (
                <Input
                  id={`custom-${field.id}`}
                  type={field.type === "phone" ? "tel" : field.type}
                  placeholder={field.placeholder || ""}
                  value={answers[field.id] || ""}
                  onChange={(event) => setAnswers((prev) => ({ ...prev, [field.id]: event.target.value }))}
                  required={field.required}
                  disabled={disabled}
                />
              )}
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="lead-phone">Phone</Label>
            <Input id="lead-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" disabled={disabled} />
          </div>
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="lead-company">Company / School</Label>
            <Input id="lead-company" value={company} onChange={(event) => setCompany(event.target.value)} placeholder="Optional" disabled={disabled} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="lead-message">Message</Label>
            <Textarea
              id="lead-message"
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Optional"
              disabled={disabled}
            />
          </div>
          <div className="sm:col-span-2">
            <Button
              className="rounded-2xl"
              disabled={disabled || loading}
              variant={appearance?.buttonVariant ?? "default"}
              aria-label="Send your contact info"
            >
              {disabled ? "Lead capture unavailable" : loading ? "Sending..." : "Send"}
            </Button>
          </div>
          <p className="sm:col-span-2 text-xs" style={mutedStyle}>
            Your information is shared privately with the owner.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
