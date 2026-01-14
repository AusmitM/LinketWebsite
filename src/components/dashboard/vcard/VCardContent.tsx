"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type VCardFields = {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  address: string;
  note: string;
  photoData: string | null;
  photoName: string | null;
};

type VCardStatusPayload = {
  status: "idle" | "saving" | "saved" | "error";
  isDirty: boolean;
  error: string | null;
  lastSavedAt: string | null;
};

export default function VCardContent({
  variant = "card",
  onFieldsChange,
  onStatusChange,
  idPrefix,
}: {
  variant?: "card" | "embedded";
  onFieldsChange?: (fields: VCardFields) => void;
  onStatusChange?: (payload: VCardStatusPayload) => void;
  idPrefix?: string;
}) {
  const [fields, setFields] = useState<VCardFields>({
    fullName: "",
    title: "",
    email: "",
    phone: "",
    company: "",
    website: "",
    address: "",
    note: "",
    photoData: null,
    photoName: null,
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const lastSavedRef = useRef<VCardFields | null>(null);
  const initialisedRef = useRef(false);
  const latestFieldsRef = useRef(fields);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    latestFieldsRef.current = fields;
  }, [fields]);

  function updateField(key: keyof VCardFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoChange(file: File | null) {
    if (!file) {
      setFields((prev) => ({ ...prev, photoData: null, photoName: null }));
      setPhotoPreview(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setFields((prev) => ({ ...prev, photoData: result, photoName: file.name }));
      setPhotoPreview(result);
    };
    reader.onerror = () => {
      setFields((prev) => ({ ...prev, photoData: null, photoName: null }));
      setPhotoPreview(null);
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        const user = data.user;
        setUserId(user?.id ?? null);
        if (!user) {
          setLoading(false);
          setStatus("error");
          setError("Sign in to edit your vCard.");
        }
      })
      .catch(() => {
        if (!active) return;
        setUserId(null);
        setLoading(false);
        setStatus("error");
        setError("Unable to verify session.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setStatus("idle");

    (async () => {
      try {
        const response = await fetch(`/api/vcard/profile?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.error || `Unable to load vCard (${response.status})`);
        }
        const payload = (await response.json()) as { fields: VCardFields };
        if (cancelled) return;
        setFields(payload.fields);
        setPhotoPreview(payload.fields.photoData);
        lastSavedRef.current = payload.fields;
        initialisedRef.current = true;
        setStatus("saved");
        setLastSavedAt(new Date().toISOString());
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to load vCard";
        setError(message);
        setStatus("error");
        initialisedRef.current = true;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const persist = useCallback(
    async (current: VCardFields) => {
      if (!userId) return;
      try {
        setStatus("saving");
        setError(null);
        const response = await fetch("/api/vcard/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, fields: current }),
        });
        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.error || `Unable to save vCard (${response.status})`);
        }
        const payload = (await response.json()) as { fields: VCardFields };
        lastSavedRef.current = payload.fields;
        if (areVCardFieldsEqual(latestFieldsRef.current, current) && !areVCardFieldsEqual(payload.fields, current)) {
          setFields(payload.fields);
          setPhotoPreview(payload.fields.photoData);
        }
        const stillDirty = !areVCardFieldsEqual(latestFieldsRef.current, payload.fields);
        setStatus(stillDirty ? "saving" : "saved");
        if (!stillDirty) {
          setLastSavedAt(new Date().toISOString());
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to save vCard";
        setStatus("error");
        setError(message);
      }
    },
    [userId]
  );


  const isDirty = useMemo(() => {
    if (!lastSavedRef.current) {
      return Boolean(fields.fullName || fields.title || fields.email || fields.phone || fields.company || fields.website || fields.address || fields.note);
    }
    return !areVCardFieldsEqual(lastSavedRef.current, fields);
  }, [fields, lastSavedAt]);

  const handleFieldBlur = useCallback(() => {
    if (!userId) return;
    if (!initialisedRef.current || loading) return;
    if (!isDirty) return;
    if (status === "saving") return;
    void persist(fields);
  }, [fields, isDirty, loading, persist, status, userId]);

  const handleContainerBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      const container = contentRef.current;
      if (!container) return;
      const nextTarget = event.relatedTarget as Node | null;
      if (nextTarget && container.contains(nextTarget)) return;
      if (!userId || loading || status === "saving" || !initialisedRef.current) return;
      if (!isDirty) return;
      void persist(latestFieldsRef.current);
    },
    [isDirty, loading, persist, status, userId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSaveRequest = () => {
      if (!userId || loading || status === "saving" || !initialisedRef.current) return;
      if (!isDirty) return;
      void persist(latestFieldsRef.current);
    };
    window.addEventListener("linket:save-request", handleSaveRequest);
    return () => window.removeEventListener("linket:save-request", handleSaveRequest);
  }, [isDirty, loading, persist, status, userId]);

  useEffect(() => {
    onFieldsChange?.(fields);
  }, [fields, onFieldsChange]);

  useEffect(() => {
    onStatusChange?.({ status, isDirty, error, lastSavedAt });
  }, [status, isDirty, error, lastSavedAt, onStatusChange]);

  const statusMessage = useMemo(() => {
    if (loading) return "Loading...";
    if (status === "saving") return "Saving changes...";
    if (status === "error") return error ?? "Save failed";
    if (isDirty) return "Changes pending";
    return "All changes saved";
  }, [loading, status, error, isDirty]);

  const inputsDisabled = loading || !userId;

  if (loading) {
    return (
      <Card
        className={
          variant === "embedded"
            ? "dashboard-skeleton rounded-2xl border border-border/60 bg-background/70 shadow-sm"
            : "dashboard-skeleton rounded-3xl border bg-card/80 shadow-sm"
        }
      >
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Contact Details</CardTitle>
          <p className="text-sm text-muted-foreground">Loading contact details...</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="h-10 w-3/4 animate-pulse rounded-xl bg-muted/60" data-skeleton />
            <div className="h-10 w-2/3 animate-pulse rounded-xl bg-muted/60" data-skeleton />
            <div className="h-10 w-5/6 animate-pulse rounded-xl bg-muted/60" data-skeleton />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-10 animate-pulse rounded-xl bg-muted/60" data-skeleton />
            <div className="h-10 animate-pulse rounded-xl bg-muted/60" data-skeleton />
            <div className="h-10 animate-pulse rounded-xl bg-muted/60" data-skeleton />
            <div className="h-10 animate-pulse rounded-xl bg-muted/60" data-skeleton />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-20 animate-pulse rounded-xl bg-muted/60" data-skeleton />
            <div className="h-20 animate-pulse rounded-xl bg-muted/60" data-skeleton />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={
        variant === "embedded"
          ? "rounded-2xl border border-border/60 bg-background/70 shadow-sm"
          : "rounded-3xl border bg-card/80 shadow-sm"
      }
    >
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Contact Details</CardTitle>
        <p className="text-sm text-muted-foreground">
          Fill in the contact fields that appear when someone taps your NFC tag.
        </p>
      </CardHeader>
      <CardContent
        className="space-y-4"
        ref={contentRef}
        onBlurCapture={handleContainerBlur}
      >
        <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-muted/70 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-full border bg-muted sm:h-20 sm:w-20">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Selected profile" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">150×150</div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-photo">Profile photo</Label>
              <Input
                id="profile-photo"
                type="file"
                accept="image/*"
                onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? null)}
                onBlur={handleFieldBlur}
                disabled={inputsDisabled}
              />
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {fields.photoName ? <span className="truncate">Selected: {fields.photoName}</span> : <span>Square image, max 1MB.</span>}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => handlePhotoChange(null)}
                  disabled={!fields.photoData}
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </section>
        <p className="text-xs text-muted-foreground">
          Include a friendly headshot or company logo. It will be embedded when you export your vCard.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" id="fullName" value={fields.fullName} onChange={updateField} onBlur={handleFieldBlur} required disabled={inputsDisabled} idPrefix={idPrefix} />
          <Field label="Title" id="title" value={fields.title} onChange={updateField} onBlur={handleFieldBlur} disabled={inputsDisabled} idPrefix={idPrefix} />
          <Field label="Email" id="email" type="email" value={fields.email} onChange={updateField} onBlur={handleFieldBlur} disabled={inputsDisabled} idPrefix={idPrefix} />
          <Field label="Phone" id="phone" type="tel" value={fields.phone} onChange={updateField} onBlur={handleFieldBlur} disabled={inputsDisabled} idPrefix={idPrefix} />
          <Field label="Company" id="company" value={fields.company} onChange={updateField} onBlur={handleFieldBlur} disabled={inputsDisabled} idPrefix={idPrefix} />
          <Field label="Website" id="website" type="url" value={fields.website} onChange={updateField} onBlur={handleFieldBlur} disabled={inputsDisabled} idPrefix={idPrefix} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" id="address" component="textarea" value={fields.address} onChange={updateField} onBlur={handleFieldBlur} disabled={inputsDisabled} idPrefix={idPrefix} />
          <Field label="Notes" id="note" component="textarea" value={fields.note} onChange={updateField} onBlur={handleFieldBlur} disabled={inputsDisabled} idPrefix={idPrefix} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}${status === "saving" ? " dashboard-saving-indicator" : ""}`}
          >
            {statusMessage}
          </span>
          {status === "error" && userId && (
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void persist(fields)}>
              Retry save
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type FieldProps = {
  label: string;
  id: keyof VCardFields;
  value: string;
  onChange: (key: keyof VCardFields, value: string) => void;
  onBlur?: () => void;
  type?: string;
  component?: "input" | "textarea";
  required?: boolean;
  disabled?: boolean;
  idPrefix?: string;
};

function Field({
  label,
  id,
  value,
  onChange,
  onBlur,
  type = "text",
  component = "input",
  required = false,
  disabled = false,
  idPrefix,
}: FieldProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextValue =
      id === "phone" && event.target instanceof HTMLInputElement
        ? formatPhoneNumber(event.target.value)
        : event.target.value;
    onChange(id, nextValue);
  }
  const fieldId = idPrefix ? `${idPrefix}-${id}` : id;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {component === "textarea" ? (
        <Textarea
          id={fieldId}
          value={value}
          rows={4}
          placeholder={required ? undefined : "Optional"}
          onChange={handleChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
        />
      ) : (
        <Input
          id={fieldId}
          value={value}
          type={type}
          placeholder={required ? undefined : "Optional"}
          onChange={handleChange}
          onBlur={onBlur}
          required={required}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function areVCardFieldsEqual(a: VCardFields, b: VCardFields) {
  return (
    a.fullName === b.fullName &&
    a.title === b.title &&
    a.email === b.email &&
    a.phone === b.phone &&
    a.company === b.company &&
    a.website === b.website &&
    a.address === b.address &&
    a.note === b.note &&
    a.photoData === b.photoData &&
    a.photoName === b.photoName
  );
}

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
}


