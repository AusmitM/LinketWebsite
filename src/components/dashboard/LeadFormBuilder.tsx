
"use client";

/**
 * Lead Capture Form Builder
 * - Schema types live in `src/types/lead-form.ts`.
 * - API routes live under `src/app/api/lead-forms`.
 * - Submissions are stored in `public.lead_form_responses` (and mirrored into `public.leads` when possible).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, GripVertical, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/system/toaster";
import { cn } from "@/lib/utils";
import {
  createDefaultLeadFormConfig,
  createField,
  normalizeLeadFormConfig,
  shuffleFields,
  shuffleOptions,
} from "@/lib/lead-form";
import type {
  LeadFormConfig,
  LeadFormField,
  LeadFormFieldType,
  LeadFormMultipleChoiceField,
  LeadFormOption,
  LeadFormRatingField,
  LeadFormTimeField,
  LeadFormValidation,
} from "@/types/lead-form";

const SAVE_DEBOUNCE_MS = 900;

const FIELD_TYPES: Array<{
  type: LeadFormFieldType;
  label: string;
  category: "basic" | "advanced";
}> = [
  { type: "short_text", label: "Short text", category: "basic" },
  { type: "long_text", label: "Long text", category: "basic" },
  { type: "multiple_choice", label: "Multiple choice", category: "basic" },
  { type: "checkboxes", label: "Checkboxes", category: "basic" },
  { type: "dropdown", label: "Dropdown", category: "basic" },
  { type: "linear_scale", label: "Linear scale", category: "basic" },
  { type: "rating", label: "Rating", category: "basic" },
  { type: "date", label: "Date", category: "basic" },
  { type: "time", label: "Time", category: "basic" },
  { type: "file_upload", label: "File upload", category: "advanced" },
  { type: "multiple_choice_grid", label: "Multiple choice grid", category: "advanced" },
  { type: "checkbox_grid", label: "Checkbox grid", category: "advanced" },
  { type: "section", label: "Section", category: "advanced" },
];

type Props = {
  userId: string;
  handle: string | null;
  profileId?: string | null;
  onPreviewChange?: (form: LeadFormConfig) => void;
};

type ResponsesStats = {
  count: number;
  lastSubmittedAt: string | null;
};

type LeadFormResponse = {
  response_id: string;
  submitted_at: string;
  updated_at: string | null;
  answers: Record<string, { value: unknown }>;
  responder_email: string | null;
};
export default function LeadFormBuilder({
  userId,
  handle,
  profileId,
  onPreviewChange,
}: Props) {
  const [form, setForm] = useState<LeadFormConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [stats, setStats] = useState<ResponsesStats>({
    count: 0,
    lastSubmittedAt: null,
  });
  const [responses, setResponses] = useState<LeadFormResponse[]>([]);
  const [responsesOpen, setResponsesOpen] = useState(false);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [advancedPickerOpen, setAdvancedPickerOpen] = useState(false);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSnapshot = useRef<string | null>(null);

  const activeField = useMemo(() => {
    if (!form || !selectedFieldId) return null;
    return form.fields.find((field) => field.id === selectedFieldId) ?? null;
  }, [form, selectedFieldId]);

  const snapshot = useMemo(() => {
    if (!form) return null;
    return JSON.stringify(form);
  }, [form]);

  const isDirty = useMemo(() => {
    if (!snapshot) return false;
    return snapshot !== lastSnapshot.current;
  }, [snapshot]);

  const previewFields = useMemo(() => {
    if (!form) return [];
    const fields = form.settings.shuffleQuestionOrder
      ? shuffleFields(form.fields)
      : form.fields.slice();
    return fields;
  }, [form]);

  useEffect(() => {
    if (!userId || !handle) return;
    setLoading(true);
    setSaveError(null);
    (async () => {
      try {
        const response = await fetch(
          `/api/lead-forms?userId=${encodeURIComponent(
            userId
          )}&handle=${encodeURIComponent(handle)}${
            profileId ? `&profileId=${encodeURIComponent(profileId)}` : ""
          }`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.error || "Unable to load form");
        }
        const payload = (await response.json()) as {
          form: LeadFormConfig;
          meta: { formId: string; stats: ResponsesStats };
        };
        const normalized = normalizeLeadFormConfig(
          payload.form,
          payload.form?.id || `form-${userId}`
        );
        setForm(normalized);
        setSelectedFieldId(normalized.fields[0]?.id ?? null);
        setStats(payload.meta?.stats ?? { count: 0, lastSubmittedAt: null });
        lastSnapshot.current = JSON.stringify(normalized);
        setLastSavedAt(payload.form?.meta?.updatedAt || null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load form";
        setSaveError(message);
        setForm(createDefaultLeadFormConfig(`form-${userId}`));
        toast({
          title: "Lead form unavailable",
          description: message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [handle, profileId, userId]);

  useEffect(() => {
    if (!form || !onPreviewChange) return;
    onPreviewChange(form);
  }, [form, onPreviewChange]);

  const persist = useCallback(async () => {
    if (!form || !userId || !handle) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/lead-forms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, handle, profileId, config: form }),
      });
      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to save form");
      }
      const payload = (await response.json()) as { form: LeadFormConfig };
      const normalized = normalizeLeadFormConfig(payload.form, form.id);
      setForm(normalized);
      lastSnapshot.current = JSON.stringify(normalized);
      setLastSavedAt(normalized.meta.updatedAt);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save form";
      setSaveError(message);
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [form, handle, profileId, userId]);

  useEffect(() => {
    if (!form || !isDirty || loading) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void persist();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
    };
  }, [form, isDirty, loading, persist]);

  const fetchResponses = useCallback(async () => {
    if (!form || !userId) return;
    setResponsesLoading(true);
    try {
      const response = await fetch(
        `/api/lead-forms/responses?userId=${encodeURIComponent(
          userId
        )}&formId=${encodeURIComponent(form.id)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to load responses");
      }
      const payload = (await response.json()) as {
        responses: LeadFormResponse[];
      };
      setResponses(payload.responses ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load responses";
      toast({
        title: "Responses unavailable",
        description: message,
        variant: "destructive",
      });
    } finally {
      setResponsesLoading(false);
    }
  }, [form, userId]);

  const updateForm = (patch: Partial<LeadFormConfig>) => {
    if (!form) return;
    const next: LeadFormConfig = {
      ...form,
      ...patch,
      meta: {
        ...form.meta,
        updatedAt: new Date().toISOString(),
        version: form.meta.version + 1,
      },
    };
    setForm(next);
  };

  const updateField = (fieldId: string, patch: Partial<LeadFormField>) => {
    if (!form) return;
    const nextFields = form.fields.map((field) =>
      field.id === fieldId
        ? normalizeFieldPatch({ ...field, ...patch } as LeadFormField)
        : field
    );
    updateForm({ fields: nextFields });
  };

  const addField = (type: LeadFormFieldType) => {
    if (!form) return;
    const newField = createField(type, "Untitled question");
    updateForm({ fields: [...form.fields, newField] });
    setSelectedFieldId(newField.id);
  };

  const duplicateField = (field: LeadFormField) => {
    if (!form) return;
    const copy = { ...field, id: `field_${randomId()}` } as LeadFormField;
    updateForm({ fields: [...form.fields, copy] });
    setSelectedFieldId(copy.id);
  };

  const deleteField = (fieldId: string) => {
    if (!form) return;
    const nextFields = form.fields.filter((field) => field.id !== fieldId);
    updateForm({ fields: nextFields });
    setSelectedFieldId(nextFields[0]?.id ?? null);
  };

  const reorderFields = (sourceId: string, targetId: string) => {
    if (!form || sourceId === targetId) return;
    const next = [...form.fields];
    const sourceIndex = next.findIndex((field) => field.id === sourceId);
    const targetIndex = next.findIndex((field) => field.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    updateForm({ fields: next });
  };

  const handleFieldTypeChange = (
    fieldId: string,
    type: LeadFormFieldType
  ) => {
    if (!form) return;
    const field = form.fields.find((item) => item.id === fieldId);
    if (!field) return;
    const migrated = migrateFieldType(field, type);
    updateField(fieldId, migrated);
  };

  if (!handle) {
    return (
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Select a profile handle to edit the lead form.
        </CardContent>
      </Card>
    );
  }

  if (loading || !form) {
    return (
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Loading lead form...
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Lead capture form</div>
            <div className="text-xs text-muted-foreground">
              {form.status === "published" ? "Published" : "Draft"}
              {lastSavedAt ? ` - Updated ${formatShortDate(lastSavedAt)}` : ""}
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <div className="rounded-full border border-border/60 px-3 py-1">
              {stats.count} submissions
            </div>
            <div className="rounded-full border border-border/60 px-3 py-1">
              {stats.lastSubmittedAt
                ? `Last ${formatShortDate(stats.lastSubmittedAt)}`
                : "No submissions yet"}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const next = !responsesOpen;
                setResponsesOpen(next);
                if (next) void fetchResponses();
              }}
            >
              {responsesOpen ? "Hide responses" : "View responses"}
            </Button>
            <Button size="sm" onClick={() => void persist()} disabled={saving}>
              {saving ? "Saving" : "Save"}
            </Button>
          </div>
        </CardContent>
        {saveError && (
          <CardContent className="pt-0 text-xs text-destructive">
            {saveError}
          </CardContent>
        )}
      </Card>

      {responsesOpen && (
        <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Responses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {responsesLoading ? (
              <div className="text-sm text-muted-foreground">
                Loading responses...
              </div>
            ) : responses.length ? (
              responses.map((resp) => (
                <div
                  key={resp.response_id}
                  className="rounded-xl border border-border/60 p-3 text-sm"
                >
                  <div className="text-xs text-muted-foreground">
                    {new Date(resp.submitted_at).toLocaleString()}
                  </div>
                  <div className="mt-2 space-y-1">
                    {Object.entries(resp.answers || {}).map(
                      ([fieldId, entry]) => (
                        <div
                          key={`${resp.response_id}-${fieldId}`}
                          className="text-xs"
                        >
                          <span className="font-semibold">{fieldId}</span>: {formatAnswer(entry.value)}
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">
                No responses yet.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Form details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lead-form-title">Title</Label>
                <Input
                  id="lead-form-title"
                  value={form.title}
                  onChange={(event) =>
                    updateForm({ title: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-form-description">Description</Label>
                <Textarea
                  id="lead-form-description"
                  value={form.description}
                  onChange={(event) =>
                    updateForm({ description: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-form-confirm">
                  Confirmation message
                </Label>
                <Textarea
                  id="lead-form-confirm"
                  value={form.settings.confirmationMessage}
                  onChange={(event) =>
                    updateForm({
                      settings: {
                        ...form.settings,
                        confirmationMessage: event.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
                    value={form.status}
                    onChange={(event) =>
                      updateForm({
                        status: event.target.value as LeadFormConfig["status"],
                      })
                    }
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Collect email</Label>
                  <select
                    className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
                    value={form.settings.collectEmail}
                    onChange={(event) =>
                      updateForm({
                        settings: {
                          ...form.settings,
                          collectEmail:
                            event.target.value as LeadFormConfig["settings"]["collectEmail"],
                        },
                      })
                    }
                  >
                    <option value="off">Off</option>
                    <option value="verified">Verified</option>
                    <option value="user_input">User input</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={form.settings.allowEditAfterSubmit}
                    onCheckedChange={(value) =>
                      updateForm({
                        settings: {
                          ...form.settings,
                          allowEditAfterSubmit: Boolean(value),
                        },
                      })
                    }
                  />
                  Allow edit after submit
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={form.settings.limitOneResponse === "on"}
                    onCheckedChange={(value) =>
                      updateForm({
                        settings: {
                          ...form.settings,
                          limitOneResponse: value ? "on" : "off",
                        },
                      })
                    }
                  />
                  Limit one response
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={form.settings.showProgressBar}
                    onCheckedChange={(value) =>
                      updateForm({
                        settings: {
                          ...form.settings,
                          showProgressBar: Boolean(value),
                        },
                      })
                    }
                  />
                  Show progress bar
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={form.settings.shuffleQuestionOrder}
                    onCheckedChange={(value) =>
                      updateForm({
                        settings: {
                          ...form.settings,
                          shuffleQuestionOrder: Boolean(value),
                        },
                      })
                    }
                  />
                  Shuffle question order
                </label>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Questions
              </CardTitle>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setFieldPickerOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add field
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.fields.length ? (
                form.fields.map((field) => (
                  <div
                    key={field.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border border-border/60 bg-background/80 p-3",
                      selectedFieldId === field.id && "ring-2 ring-primary/20"
                    )}
                    draggable
                    onDragStart={() => setDraggingFieldId(field.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggingFieldId)
                        reorderFields(draggingFieldId, field.id);
                    }}
                    onDragEnd={() => setDraggingFieldId(null)}
                    onClick={() => setSelectedFieldId(field.id)}
                  >
                    <GripVertical className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-semibold">{field.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {fieldTypeLabel(field.type)}
                        {field.required ? " - required" : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          duplicateField(field);
                        }}
                        aria-label="Duplicate field"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteField(field.id);
                        }}
                        aria-label="Delete field"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                  Add a field to start your form.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Field settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!activeField ? (
                <div className="text-sm text-muted-foreground">
                  Select a field to edit.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Label</Label>
                    <Input
                      value={activeField.label}
                      onChange={(event) =>
                        updateField(activeField.id, {
                          label: event.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Help text</Label>
                    <Input
                      value={activeField.helpText}
                      onChange={(event) =>
                        updateField(activeField.id, {
                          helpText: event.target.value,
                        })
                      }
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={activeField.required}
                      onCheckedChange={(value) =>
                        updateField(activeField.id, {
                          required: Boolean(value),
                        })
                      }
                    />
                    Required
                  </label>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <select
                      className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
                      value={activeField.type}
                      onChange={(event) =>
                        handleFieldTypeChange(
                          activeField.id,
                          event.target.value as LeadFormFieldType
                        )
                      }
                    >
                      {FIELD_TYPES.map((option) => (
                        <option key={option.type} value={option.type}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ValidationEditor
                    field={activeField}
                    onChange={(validation) =>
                      updateField(activeField.id, { validation })
                    }
                  />
                  <FieldTypeEditor
                    field={activeField}
                    onChange={(patch) => updateField(activeField.id, patch)}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Live preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-semibold">{form.title}</div>
                {form.description ? (
                  <div className="text-xs text-muted-foreground">
                    {form.description}
                  </div>
                ) : null}
              </div>
              {form.settings.showProgressBar && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-1/3 rounded-full bg-foreground/60" />
                </div>
              )}
              <div className="space-y-4">
                {previewFields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    {field.type === "section" ? (
                      <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                        <div className="text-sm font-semibold">
                          {field.title}
                        </div>
                        {field.description ? (
                          <div className="text-xs text-muted-foreground">
                            {field.description}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <Label className="text-xs text-muted-foreground">
                          {field.label}
                          {field.required ? " *" : ""}
                        </Label>
                        {field.helpText ? (
                          <div className="text-[11px] text-muted-foreground">
                            {field.helpText}
                          </div>
                        ) : null}
                        <PreviewField field={field} />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <Button className="w-full" disabled>
                Submit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={fieldPickerOpen} onOpenChange={setFieldPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a field</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                Core
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELD_TYPES.filter((item) => item.category === "basic").map(
                  (item) => (
                    <Button
                      key={item.type}
                      variant="secondary"
                      onClick={() => {
                        addField(item.type);
                        setFieldPickerOpen(false);
                      }}
                    >
                      {item.label}
                    </Button>
                  )
                )}
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs font-semibold text-muted-foreground"
                onClick={() => setAdvancedPickerOpen((prev) => !prev)}
              >
                {advancedPickerOpen ? "Hide" : "Show"} advanced fields
              </button>
              {advancedPickerOpen && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {FIELD_TYPES.filter(
                    (item) => item.category === "advanced"
                  ).map((item) => (
                    <Button
                      key={item.type}
                      variant="secondary"
                      onClick={() => {
                        addField(item.type);
                        setFieldPickerOpen(false);
                      }}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setFieldPickerOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function PreviewField({ field }: { field: LeadFormField }) {
  switch (field.type) {
    case "short_text":
      return <Input placeholder="Short answer" disabled />;
    case "long_text":
      return <Textarea placeholder="Long answer" disabled />;
    case "multiple_choice":
      return (
        <div className="space-y-2">
          {getOptions(field).map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input type="radio" disabled />
              {option.label}
            </label>
          ))}
        </div>
      );
    case "checkboxes":
      return (
        <div className="space-y-2">
          {getOptions(field).map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled />
              {option.label}
            </label>
          ))}
        </div>
      );
    case "dropdown":
      return (
        <select
          className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
          disabled
        >
          {getOptions(field).map((option) => (
            <option key={option.id}>{option.label}</option>
          ))}
        </select>
      );
    case "linear_scale":
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{field.minLabel}</span>
          <div className="flex flex-wrap gap-1">
            {Array.from({ length: field.max - field.min + 1 }).map(
              (_, index) => (
                <span
                  key={index}
                  className="rounded-full border border-border/60 px-2 py-1"
                >
                  {field.min + index}
                </span>
              )
            )}
          </div>
          <span>{field.maxLabel}</span>
        </div>
      );
    case "rating":
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: field.scale }).map((_, index) => (
            <span key={index} className="text-base text-muted-foreground">
              {ratingIcon(field.icon)}
            </span>
          ))}
        </div>
      );
    case "date":
      return <Input type={field.includeTime ? "datetime-local" : "date"} disabled />;
    case "time":
      return (
        <Input
          type={field.mode === "duration" ? "number" : "time"}
          disabled
          placeholder={field.mode === "duration" ? "Minutes" : undefined}
        />
      );
    case "file_upload":
      return <Input type="file" disabled />;
    case "multiple_choice_grid":
    case "checkbox_grid":
      return <GridPreview field={field} />;
    case "section":
      return null;
    default:
      return null;
  }
}

function GridPreview({ field }: { field: LeadFormField }) {
  if (field.type !== "multiple_choice_grid" && field.type !== "checkbox_grid")
    return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left" />
            {field.columns.map((col) => (
              <th key={col.id} className="p-2 text-left font-medium">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {field.rows.map((row) => (
            <tr key={row.id}>
              <td className="p-2 font-medium">{row.label}</td>
              {field.columns.map((col) => (
                <td key={col.id} className="p-2">
                  <input
                    type={
                      field.type === "multiple_choice_grid" ? "radio" : "checkbox"
                    }
                    disabled
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function FieldTypeEditor({
  field,
  onChange,
}: {
  field: LeadFormField;
  onChange: (patch: Partial<LeadFormField>) => void;
}) {
  switch (field.type) {
    case "multiple_choice":
    case "checkboxes":
    case "dropdown":
      return <OptionsEditor field={field} onChange={onChange} />;
    case "linear_scale":
      return (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Min</Label>
              <Input
                type="number"
                value={field.min}
                min={1}
                max={10}
                onChange={(event) =>
                  onChange({ min: Number(event.target.value || 1) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max</Label>
              <Input
                type="number"
                value={field.max}
                min={2}
                max={10}
                onChange={(event) =>
                  onChange({ max: Number(event.target.value || 2) })
                }
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Min label</Label>
              <Input
                value={field.minLabel}
                onChange={(event) => onChange({ minLabel: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max label</Label>
              <Input
                value={field.maxLabel}
                onChange={(event) => onChange({ maxLabel: event.target.value })}
              />
            </div>
          </div>
        </div>
      );
    case "rating":
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Icon</Label>
            <select
              className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
              value={field.icon}
              onChange={(event) =>
                onChange({
                  icon: event.target.value as LeadFormRatingField["icon"],
                })
              }
            >
              <option value="star">Star</option>
              <option value="heart">Heart</option>
              <option value="thumbs">Thumbs</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Scale</Label>
            <Input
              type="number"
              min={3}
              max={10}
              value={field.scale}
              onChange={(event) =>
                onChange({ scale: Number(event.target.value || 3) })
              }
            />
          </div>
        </div>
      );
    case "date":
      return (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={field.includeYear}
              onCheckedChange={(value) =>
                onChange({ includeYear: Boolean(value) })
              }
            />
            Include year
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={field.includeTime}
              onCheckedChange={(value) =>
                onChange({ includeTime: Boolean(value) })
              }
            />
            Include time
          </label>
        </div>
      );
    case "time":
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Mode</Label>
            <select
              className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
              value={field.mode}
              onChange={(event) =>
                onChange({
                  mode: event.target.value as LeadFormTimeField["mode"],
                })
              }
            >
              <option value="time_of_day">Time of day</option>
              <option value="duration">Duration</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Step minutes</Label>
            <Input
              type="number"
              value={field.stepMinutes}
              onChange={(event) =>
                onChange({ stepMinutes: Number(event.target.value || 5) })
              }
            />
          </div>
        </div>
      );
    case "file_upload":
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Accepted types</Label>
            <Input
              value={field.acceptedTypes.join(", ")}
              onChange={(event) =>
                onChange({
                  acceptedTypes: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Max files</Label>
              <Input
                type="number"
                value={field.maxFiles}
                onChange={(event) =>
                  onChange({ maxFiles: Number(event.target.value || 1) })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max size (MB)</Label>
              <Input
                type="number"
                value={field.maxSizeMB}
                onChange={(event) =>
                  onChange({ maxSizeMB: Number(event.target.value || 10) })
                }
              />
            </div>
          </div>
        </div>
      );
    case "multiple_choice_grid":
    case "checkbox_grid":
      return <GridEditor field={field} onChange={onChange} />;
    case "section":
      return (
        <div className="space-y-2">
          <Label>Section title</Label>
          <Input
            value={field.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
          <Label>Description</Label>
          <Textarea
            value={field.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </div>
      );
    default:
      return null;
  }
}

function OptionsEditor({
  field,
  onChange,
}: {
  field: LeadFormField;
  onChange: (patch: Partial<LeadFormField>) => void;
}) {
  if (
    field.type !== "multiple_choice" &&
    field.type !== "checkboxes" &&
    field.type !== "dropdown"
  ) {
    return null;
  }
  const options = getOptions(field);
  const updateOptions = (next: LeadFormOption[]) => onChange({ options: next });
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Options</Label>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                value={option.label}
                onChange={(event) => {
                  const next = [...options];
                  next[index] = { ...option, label: event.target.value };
                  updateOptions(next);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  updateOptions(options.filter((item) => item.id !== option.id))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              updateOptions([
                ...options,
                { id: `opt_${randomId()}`, label: `Option ${options.length + 1}` },
              ])
            }
          >
            Add option
          </Button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={field.allowOther}
          onCheckedChange={(value) =>
            onChange({ allowOther: Boolean(value) })
          }
        />
        Allow other
      </label>
      {field.allowOther && (
        <Input
          value={field.otherLabel}
          onChange={(event) => onChange({ otherLabel: event.target.value })}
          placeholder="Other"
        />
      )}
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={Boolean(field.presentation?.shuffleOptions)}
          onCheckedChange={(value) =>
            onChange({
              presentation: {
                ...field.presentation,
                shuffleOptions: Boolean(value),
              },
            })
          }
        />
        Shuffle options
      </label>
    </div>
  );
}
function GridEditor({
  field,
  onChange,
}: {
  field: LeadFormField;
  onChange: (patch: Partial<LeadFormField>) => void;
}) {
  if (field.type !== "multiple_choice_grid" && field.type !== "checkbox_grid")
    return null;
  const updateRows = (rows: LeadFormOption[]) => onChange({ rows });
  const updateColumns = (columns: LeadFormOption[]) => onChange({ columns });
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Rows</Label>
        {field.rows.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              value={row.label}
              onChange={(event) => {
                const next = [...field.rows];
                next[index] = { ...row, label: event.target.value };
                updateRows(next);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                updateRows(field.rows.filter((item) => item.id !== row.id))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            updateRows([
              ...field.rows,
              { id: `row_${randomId()}`, label: `Row ${field.rows.length + 1}` },
            ])
          }
        >
          Add row
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Columns</Label>
        {field.columns.map((col, index) => (
          <div key={col.id} className="flex items-center gap-2">
            <Input
              value={col.label}
              onChange={(event) => {
                const next = [...field.columns];
                next[index] = { ...col, label: event.target.value };
                updateColumns(next);
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                updateColumns(field.columns.filter((item) => item.id !== col.id))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            updateColumns([
              ...field.columns,
              {
                id: `col_${randomId()}`,
                label: `Column ${field.columns.length + 1}`,
              },
            ])
          }
        >
          Add column
        </Button>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={field.gridRules.requireResponsePerRow}
          onCheckedChange={(value) =>
            onChange({
              gridRules: {
                ...field.gridRules,
                requireResponsePerRow: Boolean(value),
              },
            })
          }
        />
        Require response per row
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Switch
          checked={field.gridRules.limitOneResponsePerColumn}
          onCheckedChange={(value) =>
            onChange({
              gridRules: {
                ...field.gridRules,
                limitOneResponsePerColumn: Boolean(value),
              },
            })
          }
        />
        Limit one response per column
      </label>
    </div>
  );
}

function ValidationEditor({
  field,
  onChange,
}: {
  field: LeadFormField;
  onChange: (validation: LeadFormValidation) => void;
}) {
  const options = getValidationOptions(field.type);
  if (!options.length) return null;
  const rule = field.validation?.rule || "none";
  const value = field.validation?.value;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Validation</Label>
        <select
          className="h-10 w-full rounded-md border border-border/60 bg-background px-3 text-sm"
          value={rule}
          onChange={(event) => onChange({ rule: event.target.value })}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {needsValidationValue(rule) && (
        <ValidationValueInput
          rule={rule}
          value={value}
          onChange={(val) =>
            onChange({ ...field.validation, rule, value: val })
          }
        />
      )}
      <div className="space-y-2">
        <Label>Error message</Label>
        <Input
          value={field.validation?.message || ""}
          onChange={(event) =>
            onChange({ ...field.validation, message: event.target.value })
          }
          placeholder="Optional"
        />
      </div>
    </div>
  );
}

function ValidationValueInput({
  rule,
  value,
  onChange,
}: {
  rule: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (rule === "length_range" || rule === "selection_range") {
    const current = (value as { min?: number; max?: number }) || {};
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          type="number"
          placeholder="Min"
          value={current.min ?? ""}
          onChange={(event) =>
            onChange({ ...current, min: Number(event.target.value || 0) })
          }
        />
        <Input
          type="number"
          placeholder="Max"
          value={current.max ?? ""}
          onChange={(event) =>
            onChange({ ...current, max: Number(event.target.value || 0) })
          }
        />
      </div>
    );
  }
  if (rule === "date_range" || rule === "time_range") {
    const current = (value as { min?: string; max?: string }) || {};
    const inputType = rule === "date_range" ? "date" : "time";
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          type={inputType}
          value={current.min ?? ""}
          onChange={(event) => onChange({ ...current, min: event.target.value })}
        />
        <Input
          type={inputType}
          value={current.max ?? ""}
          onChange={(event) => onChange({ ...current, max: event.target.value })}
        />
      </div>
    );
  }
  if (rule === "regex") {
    return (
      <Input
        placeholder="Regex"
        value={String(value ?? "")}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <Input
      type="number"
      value={value as number | string | undefined}
      onChange={(event) => onChange(Number(event.target.value || 0))}
    />
  );
}

function getValidationOptions(type: LeadFormFieldType) {
  switch (type) {
    case "short_text":
      return [
        { value: "none", label: "None" },
        { value: "email", label: "Email" },
        { value: "url", label: "URL" },
        { value: "regex", label: "Regex" },
        { value: "min_length", label: "Min length" },
        { value: "max_length", label: "Max length" },
        { value: "length_range", label: "Length range" },
      ];
    case "long_text":
      return [
        { value: "none", label: "None" },
        { value: "max_length", label: "Max length" },
        { value: "length_range", label: "Length range" },
        { value: "regex", label: "Regex" },
      ];
    case "checkboxes":
      return [
        { value: "none", label: "None" },
        { value: "min_selections", label: "Min selections" },
        { value: "max_selections", label: "Max selections" },
        { value: "selection_range", label: "Selection range" },
      ];
    case "date":
      return [
        { value: "none", label: "None" },
        { value: "min_date", label: "Min date" },
        { value: "max_date", label: "Max date" },
        { value: "date_range", label: "Date range" },
      ];
    case "time":
      return [
        { value: "none", label: "None" },
        { value: "min_time", label: "Min time" },
        { value: "max_time", label: "Max time" },
        { value: "time_range", label: "Time range" },
      ];
    default:
      return [{ value: "none", label: "None" }];
  }
}

function needsValidationValue(rule: string) {
  return rule !== "none" && rule !== "email" && rule !== "url";
}

function migrateFieldType(
  field: LeadFormField,
  nextType: LeadFormFieldType
): Partial<LeadFormField> {
  const base = createField(nextType, field.label, {
    id: field.id,
    helpText: field.helpText,
    required: field.required,
  });
  if ("options" in field && "options" in base) {
    base.options = field.options;
  }
  if (
    field.type === "multiple_choice" &&
    nextType === "dropdown" &&
    "allowOther" in base
  ) {
    const multiField = field as LeadFormMultipleChoiceField;
    base.allowOther = multiField.allowOther;
    base.otherLabel = multiField.otherLabel;
  }
  return base;
}

function normalizeFieldPatch(field: LeadFormField): LeadFormField {
  if (
    field.type === "multiple_choice" ||
    field.type === "checkboxes" ||
    field.type === "dropdown"
  ) {
    return {
      ...field,
      options: field.options?.length
        ? field.options
        : [{ id: `opt_${randomId()}`, label: "Option 1" }],
      otherLabel: field.otherLabel || "Other",
    } as LeadFormField;
  }
  return field;
}

function getOptions(field: LeadFormField): LeadFormOption[] {
  if (
    field.type !== "multiple_choice" &&
    field.type !== "checkboxes" &&
    field.type !== "dropdown"
  )
    return [];
  const options = field.options || [];
  return field.presentation?.shuffleOptions ? shuffleOptions(options) : options;
}

function fieldTypeLabel(type: LeadFormFieldType) {
  return FIELD_TYPES.find((item) => item.type === type)?.label || type;
}

function ratingIcon(icon: "star" | "heart" | "thumbs") {
  if (icon === "heart") return "H";
  if (icon === "thumbs") return "T";
  return "*";
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAnswer(value: unknown) {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (
      (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ||
      Math.random().toString(36).slice(2, 10)
    );
  }
  return Math.random().toString(36).slice(2, 10);
}
