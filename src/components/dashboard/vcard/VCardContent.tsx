"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
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

export default function VCardContent() {
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<VCardFields | null>(null);
  const initialisedRef = useRef(false);
  const latestFieldsRef = useRef(fields);

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
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to save vCard";
        setStatus("error");
        setError(message);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    if (!initialisedRef.current || loading) return;
    if (lastSavedRef.current && areVCardFieldsEqual(lastSavedRef.current, fields)) {
      return;
    }
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    setStatus("saving");
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist(fields);
    }, 800);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [fields, userId, loading, persist]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const isDirty = useMemo(() => {
    if (!lastSavedRef.current) {
      return Boolean(fields.fullName || fields.title || fields.email || fields.phone || fields.company || fields.website || fields.address || fields.note);
    }
    return !areVCardFieldsEqual(lastSavedRef.current, fields);
  }, [fields]);

  const statusMessage = useMemo(() => {
    if (loading) return "Loading...";
    if (status === "saving") return "Saving changes...";
    if (status === "error") return error ?? "Save failed";
    if (isDirty) return "Changes pending";
    return "All changes saved";
  }, [loading, status, error, isDirty]);

  const inputsDisabled = loading || !userId;

  return (
    <Card className="rounded-3xl border bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">vCard details</CardTitle>
        <p className="text-sm text-muted-foreground">Fill in the contact fields that appear when someone taps your NFC tag.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-muted/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full border bg-muted">
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
          <p className="text-xs text-muted-foreground sm:max-w-xs">
            Include a friendly headshot or company logo. It will be embedded when you export your vCard.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" id="fullName" value={fields.fullName} onChange={updateField} required disabled={inputsDisabled} />
          <Field label="Title" id="title" value={fields.title} onChange={updateField} disabled={inputsDisabled} />
          <Field label="Email" id="email" type="email" value={fields.email} onChange={updateField} disabled={inputsDisabled} />
          <Field label="Phone" id="phone" type="tel" value={fields.phone} onChange={updateField} disabled={inputsDisabled} />
          <Field label="Company" id="company" value={fields.company} onChange={updateField} disabled={inputsDisabled} />
          <Field label="Website" id="website" type="url" value={fields.website} onChange={updateField} disabled={inputsDisabled} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address" id="address" component="textarea" value={fields.address} onChange={updateField} disabled={inputsDisabled} />
          <Field label="Notes" id="note" component="textarea" value={fields.note} onChange={updateField} disabled={inputsDisabled} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>{statusMessage}</span>
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
  type?: string;
  component?: "input" | "textarea";
  required?: boolean;
  disabled?: boolean;
};

function Field({ label, id, value, onChange, type = "text", component = "input", required = false, disabled = false }: FieldProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    onChange(id, event.target.value);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {component === "textarea" ? (
        <Textarea
          id={id}
          value={value}
          rows={4}
          placeholder={required ? undefined : "Optional"}
          onChange={handleChange}
          required={required}
          disabled={disabled}
        />
      ) : (
        <Input
          id={id}
          value={value}
          type={type}
          placeholder={required ? undefined : "Optional"}
          onChange={handleChange}
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


