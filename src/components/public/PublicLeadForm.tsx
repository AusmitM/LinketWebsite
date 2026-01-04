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
  custom_fields jsonb,
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
import { cn } from "@/lib/utils";

const FIELD_TYPES = ["text", "email", "phone", "textarea", "select", "checkbox"] as const;

type FieldType = (typeof FIELD_TYPES)[number];

type DynamicField = {
  id: string;
  key: string | null;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string | null;
  options: string[] | null;
  is_hidden: boolean | null;
  order_index: number;
};

type AnswersMap = Record<string, string | boolean>;

type Appearance = {
  cardBackground: string;
  cardBorder: string;
  text: string;
  muted: string;
  buttonVariant: "default" | "secondary";
};

type FormSettings = {
  submitLabel: string;
  successMessage: string;
  redirectEnabled: boolean;
  redirectUrl: string;
  consentEnabled: boolean;
  consentLabel: string;
  spamProtection: boolean;
};

type Props = {
  ownerId?: string | null;
  handle: string;
  appearance?: Appearance;
  variant?: "card" | "profile";
  className?: string;
};

const DEFAULT_SETTINGS: FormSettings = {
  submitLabel: "Send",
  successMessage: "Thanks! I'll reach out soon.",
  redirectEnabled: false,
  redirectUrl: "",
  consentEnabled: false,
  consentLabel: "I agree to share my info.",
  spamProtection: false,
};

export default function PublicLeadForm({
  ownerId,
  handle,
  appearance,
  variant = "card",
  className,
}: Props) {
  const [fields, setFields] = useState<DynamicField[]>([]);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_SETTINGS);
  const [consentChecked, setConsentChecked] = useState(false);
  const [trap, setTrap] = useState("");
  const [loading, setLoading] = useState(false);

  const disabled = !ownerId;
  const sourceUrl = useMemo(() => {
    try {
      return window?.location?.href ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!handle) {
      setFields([]);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("lead_form_fields")
          .select("id,key,label,type,required,placeholder,options,is_hidden,order_index")
          .eq("handle", handle)
          .eq("is_active", true)
          .order("order_index", { ascending: true });
        if (!error && data) {
          const mapped = (data as unknown as DynamicField[])
            .filter((field) => !field.is_hidden)
            .map((field) => ({ ...field }));
          setFields(mapped || []);
        }
      } catch {}
    })();
  }, [handle]);

  useEffect(() => {
    if (!handle) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("lead_form_settings")
          .select("settings")
          .eq("handle", handle)
          .maybeSingle();
        if (!error && data?.settings) {
          setSettings((prev) => ({ ...prev, ...(data.settings as FormSettings) }));
        }
      } catch {}
    })();
  }, [handle]);

  const cardStyle = appearance
    ? { background: appearance.cardBackground, borderColor: appearance.cardBorder, color: appearance.text }
    : undefined;

  const mutedStyle = appearance ? { color: appearance.muted } : undefined;
  const inputClassName =
    variant === "profile"
      ? "h-10 rounded-xl border-border/70 bg-muted/60 px-3 text-sm shadow-sm"
      : "";
  const textareaClassName =
    variant === "profile"
      ? "min-h-20 rounded-xl border-border/70 bg-muted/60 px-3 py-2 text-sm shadow-sm"
      : "";
  const buttonClassName =
    variant === "profile"
      ? "w-fit rounded-full px-5 py-1.5 text-sm shadow-[0_10px_24px_-18px_var(--ring)]"
      : "rounded-2xl";

  function setAnswer(key: string, value: string | boolean) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function fieldKey(field: DynamicField) {
    return normalizeKey(field.key || field.label || field.id);
  }

  function getValueForKey(key: string) {
    return answers[key];
  }

  function buildLeadPayload() {
    const values: Record<string, string | boolean> = {};
    fields.forEach((field) => {
      const key = fieldKey(field);
      values[key] = answers[key] ?? (field.type === "checkbox" ? false : "");
    });

    const nameValue =
      (values.name as string) ||
      combineName(values.first_name as string, values.last_name as string) ||
      (values.full_name as string) ||
      "";
    const emailValue = (values.email as string) || "";
    const phoneValue = (values.phone as string) || "";
    const companyValue = (values.company as string) || (values.school as string) || "";
    const messageValue = (values.message as string) || (values.notes as string) || "";

    return {
      name: nameValue.trim(),
      email: emailValue.trim(),
      phone: phoneValue.trim() || null,
      company: companyValue.trim() || null,
      message: messageValue.trim() || null,
      customFields: values,
    };
  }

  function validateRequired() {
    const missing = fields.filter((field) => {
      if (!field.required) return false;
      const key = fieldKey(field);
      const value = answers[key];
      if (field.type === "checkbox") return value !== true;
      return !value || String(value).trim().length === 0;
    });
    if (settings.consentEnabled && !consentChecked) {
      return { ok: false, message: "Please accept the consent checkbox." };
    }
    if (missing.length) {
      return { ok: false, message: "Please fill in the required fields." };
    }
    return { ok: true };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!ownerId) {
      toast({ title: "Unavailable", description: "Owner not found.", variant: "destructive" });
      return;
    }

    const validation = validateRequired();
    if (!validation.ok) {
      toast({ title: "Missing info", description: validation.message, variant: "destructive" });
      return;
    }

    if (trap.trim().length > 0) {
      toast({ title: "Thanks!", description: settings.successMessage, variant: "success" });
      resetForm();
      return;
    }

    const payloadData = buildLeadPayload();
    if (!payloadData.name || !payloadData.email) {
      toast({ title: "Missing info", description: "Name and email required.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // TODO: enforce spamProtection in the server-side submit handler.
      const payload: Record<string, unknown> = {
        user_id: ownerId,
        handle,
        name: payloadData.name,
        email: payloadData.email,
        phone: payloadData.phone,
        company: payloadData.company,
        message: payloadData.message,
        source_url: sourceUrl,
        custom_fields: payloadData.customFields,
      };
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
      // TODO: send notifications in an edge function when notify settings are enabled.
      fetch("/api/leads/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, honeypot: trap || null }),
      }).catch(() => {});
      resetForm();
      toast({ title: "Thanks!", description: settings.successMessage, variant: "success" });
      if (settings.redirectEnabled && settings.redirectUrl) {
        window.location.assign(settings.redirectUrl);
      }
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
    setAnswers({});
    setConsentChecked(false);
    setTrap("");
  }

  async function safeJson(response: Response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const enabledFields = fields.filter((field) => !field.is_hidden);

  if (variant === "profile") {
    return (
      <section className={cn("space-y-3", className)} style={appearance ? { color: appearance.text } : undefined}>
        <form className="space-y-3" onSubmit={onSubmit} aria-label="Contact the owner">
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
          {enabledFields.map((field) => {
            const key = fieldKey(field);
            const value = answers[key] ?? "";
            return (
              <div key={field.id} className="space-y-1.5">
                <Label htmlFor={`lead-${key}`} className="text-xs text-muted-foreground">
                  {field.label}
                  {field.required ? " (required)" : ""}
                </Label>
                {renderFieldInput({
                  field,
                  id: `lead-${key}`,
                  value,
                  inputClassName,
                  textareaClassName,
                  disabled,
                  onChange: (val) => setAnswer(key, val),
                })}
              </div>
            );
          })}
          {settings.consentEnabled && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
                disabled={disabled}
              />
              {settings.consentLabel}
            </label>
          )}
          <div>
            <Button
              className={cn(buttonClassName, "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:brightness-95")}
              disabled={disabled || loading}
              aria-label="Send your contact info"
            >
              {disabled ? "Lead capture unavailable" : loading ? "Sending..." : settings.submitLabel}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground" style={mutedStyle}>
            Your information is shared privately with the owner.
          </p>
        </form>
      </section>
    );
  }

  return (
    <Card className={cn("rounded-2xl", className)} style={cardStyle}>
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
          {enabledFields.map((field) => {
            const key = fieldKey(field);
            const value = answers[key] ?? "";
            return (
              <div
                key={field.id}
                className={`space-y-1.5 sm:col-span-1 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={`lead-${key}`}>{field.label}</Label>
                {renderFieldInput({
                  field,
                  id: `lead-${key}`,
                  value,
                  disabled,
                  onChange: (val) => setAnswer(key, val),
                })}
              </div>
            );
          })}
          {settings.consentEnabled && (
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(event) => setConsentChecked(event.target.checked)}
                  disabled={disabled}
                />
                {settings.consentLabel}
              </label>
            </div>
          )}
          <div className="sm:col-span-2">
            <Button
              className={buttonClassName}
              disabled={disabled || loading}
              variant={appearance?.buttonVariant ?? "default"}
              aria-label="Send your contact info"
            >
              {disabled ? "Lead capture unavailable" : loading ? "Sending..." : settings.submitLabel}
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

function renderFieldInput({
  field,
  id,
  value,
  onChange,
  inputClassName,
  textareaClassName,
  disabled,
}: {
  field: DynamicField;
  id: string;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  inputClassName?: string;
  textareaClassName?: string;
  disabled?: boolean;
}) {
  if (field.type === "textarea") {
    return (
      <Textarea
        id={id}
        rows={3}
        placeholder={field.placeholder || ""}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        disabled={disabled}
        className={textareaClassName}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        id={id}
        className={cn("h-10 rounded-xl border border-border/70 bg-muted/60 px-3 text-sm", inputClassName)}
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
        disabled={disabled}
      >
        <option value="">Select</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          required={field.required}
          disabled={disabled}
        />
        {field.placeholder || "Yes"}
      </label>
    );
  }
  return (
    <Input
      id={id}
      type={field.type === "phone" ? "tel" : field.type}
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder || ""}
      className={inputClassName}
      required={field.required}
      disabled={disabled}
    />
  );
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function combineName(first?: string, last?: string) {
  return [first || "", last || ""].filter(Boolean).join(" ").trim();
}
