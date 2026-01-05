"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreVertical,
  Smartphone,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/system/toaster";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LeadField } from "@/types/db";

const SAVE_DEBOUNCE_MS = 2000;

const FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "textarea",
  "select",
  "checkbox",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

type FieldValidation = {
  minLength?: number | null;
  emailFormat?: boolean;
};

export type BuilderField = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  enabled: boolean;
  hidden: boolean;
  placeholder: string;
  options: string[];
  validation: FieldValidation;
};

export type FormSettings = {
  submitLabel: string;
  successMessage: string;
  redirectEnabled: boolean;
  redirectUrl: string;
  consentEnabled: boolean;
  consentLabel: string;
  spamProtection: boolean;
  notifyEnabled: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  published: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type Props = {
  userId: string;
  handle: string | null;
  variant?: "default" | "compact";
  onPreviewChange?: (preview: LeadFormPreview) => void;
};

type Template = {
  id: string;
  label: string;
  fields: Array<Omit<BuilderField, "id">>;
};

export type LeadFormPreview = {
  fields: BuilderField[];
  settings: FormSettings;
};

const DEFAULT_SETTINGS: FormSettings = {
  submitLabel: "Send",
  successMessage: "Thanks! I'll reach out soon.",
  redirectEnabled: false,
  redirectUrl: "",
  consentEnabled: false,
  consentLabel: "I agree to share my info.",
  spamProtection: false,
  notifyEnabled: false,
  notifyEmail: true,
  notifySms: false,
  published: false,
};

const TEMPLATES: Template[] = [
  {
    id: "basic",
    label: "Basic contact",
    fields: [
      buildTemplateField("Name", "text", { required: true, key: "name" }),
      buildTemplateField("Email", "email", { required: true, key: "email" }),
      buildTemplateField("Message", "textarea", { key: "message" }),
    ],
  },
  {
    id: "demo",
    label: "Request a demo",
    fields: [
      buildTemplateField("Name", "text", { required: true, key: "name" }),
      buildTemplateField("Email", "email", { required: true, key: "email" }),
      buildTemplateField("Company", "text", { key: "company" }),
      buildTemplateField("Role", "text", { key: "role" }),
    ],
  },
  {
    id: "quote",
    label: "Get a quote",
    fields: [
      buildTemplateField("Name", "text", { required: true, key: "name" }),
      buildTemplateField("Email", "email", { required: true, key: "email" }),
      buildTemplateField("Budget", "select", {
        key: "budget",
        options: ["<$1k", "$1k-$5k", "$5k-$10k", "$10k+"],
      }),
      buildTemplateField("Notes", "textarea", { key: "notes" }),
    ],
  },
  {
    id: "intro",
    label: "Book an intro",
    fields: [
      buildTemplateField("Name", "text", { required: true, key: "name" }),
      buildTemplateField("Email", "email", { required: true, key: "email" }),
      buildTemplateField("Preferred time", "text", { key: "preferred_time" }),
    ],
  },
  {
    id: "waitlist",
    label: "Waitlist",
    fields: [
      buildTemplateField("Email", "email", { required: true, key: "email" }),
    ],
  },
];

export default function LeadFormBuilder({
  userId,
  handle,
  variant = "default",
  onPreviewChange,
}: Props) {
  const [fields, setFields] = useState<BuilderField[]>([]);
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_SETTINGS);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  const [advancedFields, setAdvancedFields] = useState<Record<string, boolean>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"build" | "preview">("build");
  const [menuOpen, setMenuOpen] = useState(false);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<Template | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [previewSuccess, setPreviewSuccess] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingSave = useRef(false);
  const lastSnapshotRef = useRef<string | null>(null);
  const lastSavedFieldIds = useRef<string[]>([]);
  const keyToIdRef = useRef<Map<string, string>>(new Map());
  const loadToken = useRef(0);
  const buttonSaveRequested = useRef(false);

  const showPreview = variant !== "compact";

  const snapshot = useMemo(
    () => JSON.stringify({ fields, settings }),
    [fields, settings]
  );

  const isDirty = useMemo(
    () => snapshot !== lastSnapshotRef.current,
    [snapshot]
  );

  const orderedFields = useMemo(() => fields, [fields]);

  useEffect(() => {
    if (!userId || !handle) {
      setFields([]);
      setSettings(DEFAULT_SETTINGS);
      setSelectedFieldId(null);
      setLoading(false);
      lastSnapshotRef.current = JSON.stringify({
        fields: [],
        settings: DEFAULT_SETTINGS,
      });
      lastSavedFieldIds.current = [];
      return;
    }

    let active = true;
    const currentLoad = (loadToken.current += 1);
    setLoading(true);

    (async () => {
      try {
        const [fieldsRes, settingsRes] = await Promise.all([
          supabase
            .from("lead_form_fields")
            .select(
              "id,user_id,handle,key,label,type,required,placeholder,options,is_hidden,validation,order_index,is_active,created_at"
            )
            .eq("user_id", userId)
            .eq("handle", handle)
            .order("order_index", { ascending: true }),
          supabase
            .from("lead_form_settings")
            .select("settings")
            .eq("user_id", userId)
            .eq("handle", handle)
            .maybeSingle(),
        ]);

        if (!active || currentLoad !== loadToken.current) return;

        if (fieldsRes.error) throw fieldsRes.error;
        if (settingsRes.error) throw settingsRes.error;

        const rawFields = (fieldsRes.data || []) as LeadField[];
        const mappedFields = ensureUniqueKeys(
          rawFields.map((field) => mapFieldFromDb(field))
        );
        keyToIdRef.current = new Map(
          mappedFields.map((field) => [field.key, field.id])
        );
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...(settingsRes.data?.settings as Partial<FormSettings> | undefined),
        } as FormSettings;

        setFields(mappedFields);
        setSettings(mergedSettings);
        setSelectedFieldId(mappedFields[0]?.id ?? null);
        setSaveState("saved");
        setLastSavedAt(new Date().toISOString());
        lastSnapshotRef.current = JSON.stringify({
          fields: mappedFields,
          settings: mergedSettings,
        });
        lastSavedFieldIds.current = mappedFields.map((field) => field.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load lead form";
        toast({
          title: "Lead form unavailable",
          description: message,
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [handle, userId]);

  const persist = useCallback(
    async (next?: { fields?: BuilderField[]; settings?: FormSettings }) => {
      if (!userId || !handle) return;
      if (savingRef.current) {
        pendingSave.current = true;
        return;
      }
      const nextFields = ensureUniqueKeys(next?.fields ?? fields);
      const nextSettings = next?.settings ?? settings;
      savingRef.current = true;
      pendingSave.current = false;
      setSaveState("saving");

      try {
        const nextKeyMap = new Map<string, string>();
        const ordered = nextFields.map((field, index) => ({
          id: keyToIdRef.current.get(field.key) ?? field.id,
          user_id: userId,
          handle,
          key: field.key,
          label: field.label,
          type: field.type,
          required: field.required,
          placeholder: field.placeholder || null,
          options: field.options.length ? field.options : null,
          is_hidden: field.hidden,
          validation: field.validation,
          order_index: index + 1,
          is_active: field.enabled,
        }));
        ordered.forEach((field) => {
          nextKeyMap.set(field.key, field.id);
        });

        if (ordered.length) {
          const { error } = await supabase
            .from("lead_form_fields")
            .upsert(ordered, { onConflict: "user_id,handle,key" });
          if (error) throw error;
        }

        const currentIds = ordered.map((field) => field.id);
        const removedIds = lastSavedFieldIds.current.filter(
          (id) => !currentIds.includes(id)
        );
        if (removedIds.length) {
          const { error } = await supabase
            .from("lead_form_fields")
            .delete()
            .eq("user_id", userId)
            .eq("handle", handle)
            .in("id", removedIds);
          if (error) throw error;
        }

        const { error: settingsError } = await supabase
          .from("lead_form_settings")
          .upsert(
            {
              user_id: userId,
              handle,
              settings: nextSettings,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,handle" }
          );
        if (settingsError) throw settingsError;

        setFields(nextFields);
        setSettings(nextSettings);
        setSaveState("saved");
        setLastSavedAt(new Date().toISOString());
        lastSnapshotRef.current = JSON.stringify({
          fields: nextFields,
          settings: nextSettings,
        });
        lastSavedFieldIds.current = currentIds;
        keyToIdRef.current = nextKeyMap;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Save failed";
        setSaveState("error");
        toast({
          title: "Save failed",
          description: message,
          variant: "destructive",
        });
      } finally {
        savingRef.current = false;
        if (pendingSave.current) {
          pendingSave.current = false;
          void persist();
        }
      }
    },
    [fields, handle, settings, userId]
  );

  useEffect(() => {
    if (!userId || !handle) return;
    if (loading) return;
    if (!isDirty) return;

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
    }
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void persist();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [handle, isDirty, loading, persist, userId]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest("button, [role='button']")) return;
      buttonSaveRequested.current = true;
    };
    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    if (!buttonSaveRequested.current) return;
    if (!userId || !handle || !isDirty) {
      buttonSaveRequested.current = false;
      return;
    }
    if (loading) return;
    buttonSaveRequested.current = false;
    void persist();
  }, [handle, isDirty, loading, persist, userId]);

  const applyTemplate = useCallback(
    (template: Template) => {
      const nextFields = ensureUniqueKeys(
        template.fields.map((field) => ({
          ...ensureFieldDefaults(field),
          id: createId(),
        }))
      );
      setFields(nextFields);
      setSelectedFieldId(nextFields[0]?.id ?? null);
      setExpandedFields(
        nextFields[0]?.id ? { [nextFields[0].id]: true } : {}
      );
      setAdvancedFields({});
      setPreviewSuccess(false);
    },
    []
  );

  const handleTemplateSelect = useCallback(
    (template: Template) => {
      if (fields.length || isDirty) {
        setPendingTemplate(template);
        setTemplateConfirmOpen(true);
        return;
      }
      applyTemplate(template);
    },
    [applyTemplate, fields.length, isDirty]
  );

  const handleAddField = useCallback((field: Omit<BuilderField, "id">) => {
    const next: BuilderField = {
      ...ensureFieldDefaults(field),
      id: createId(),
    };
    setFields((prev) => ensureUniqueKeys([...prev, next]));
    setSelectedFieldId(next.id);
    setExpandedFields((prev) => ({ ...prev, [next.id]: true }));
  }, []);

  const updateField = useCallback(
    (fieldId: string, patch: Partial<BuilderField>) => {
      setFields((prev) =>
        ensureUniqueKeys(
          prev.map((field) =>
            field.id === fieldId ? { ...field, ...patch } : field
          )
        )
      );
    },
    []
  );

  const toggleExpanded = useCallback((fieldId: string) => {
    setExpandedFields((prev) => ({
      ...prev,
      [fieldId]: !prev[fieldId],
    }));
  }, []);

  const toggleAdvanced = useCallback((fieldId: string) => {
    setAdvancedFields((prev) => ({
      ...prev,
      [fieldId]: !prev[fieldId],
    }));
  }, []);

  const moveField = useCallback(
    (fieldId: string, direction: "up" | "down") => {
      setFields((prev) => {
        const index = prev.findIndex((field) => field.id === fieldId);
        if (index === -1) return prev;
        const nextIndex = direction === "up" ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= prev.length) return prev;
        const next = [...prev];
        const [moved] = next.splice(index, 1);
        next.splice(nextIndex, 0, moved);
        return next;
      });
    },
    []
  );

  const handleDeleteField = useCallback((fieldId: string) => {
    setFields((prev) => prev.filter((field) => field.id !== fieldId));
    setSelectedFieldId((current) =>
      current === fieldId ? null : current
    );
  }, []);

  const handleDuplicate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ fields, settings }, null, 2)
      );
      toast({ title: "Configuration copied" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Copy failed";
      toast({ title: "Copy failed", description: message, variant: "destructive" });
    }
  }, [fields, settings]);

  const handleReset = useCallback(() => {
    applyTemplate(TEMPLATES[0]);
    setResetConfirmOpen(false);
  }, [applyTemplate]);

  const handleDelete = useCallback(async () => {
    if (!userId || !handle) return;
    try {
      await supabase
        .from("lead_form_fields")
        .delete()
        .eq("user_id", userId)
        .eq("handle", handle);
      await supabase
        .from("lead_form_settings")
        .delete()
        .eq("user_id", userId)
        .eq("handle", handle);
      setFields([]);
      setSettings(DEFAULT_SETTINGS);
      setSelectedFieldId(null);
      setSaveState("idle");
      setLastSavedAt(new Date().toISOString());
      lastSnapshotRef.current = JSON.stringify({
        fields: [],
        settings: DEFAULT_SETTINGS,
      });
      lastSavedFieldIds.current = [];
      toast({ title: "Form deleted" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Delete failed";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    } finally {
      setDeleteConfirmOpen(false);
    }
  }, [handle, userId]);

  const handlePublish = useCallback(() => {
    const next = { ...settings, published: true };
    setSettings(next);
    void persist({ settings: next });
  }, [persist, settings]);

  const handleTestSubmit = useCallback(() => {
    setPreviewSuccess(true);
    setTestModalOpen(false);
  }, []);

  const previewFields = useMemo(
    () => orderedFields.filter((field) => field.enabled && !field.hidden),
    [orderedFields]
  );

  useEffect(() => {
    if (!onPreviewChange) return;
    onPreviewChange({ fields, settings });
  }, [fields, onPreviewChange, settings]);

  return (
    <div className={cn("space-y-4", variant === "compact" && "space-y-3")}>
      {variant !== "compact" && (
        <div className="sticky top-0 z-10 -mx-4 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 lg:-mx-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Lead form</h2>
              <span className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                {settings.published ? "Published" : "Draft"}
              </span>
              <span className="text-xs text-muted-foreground">
                {saveState === "saving"
                  ? "Saving"
                  : saveState === "error"
                  ? "Save failed"
                  : "Saved"}
                {lastSavedAt ? ` · ${formatShortDate(lastSavedAt)}` : ""}
              </span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTestModalOpen(true)}
              >
                Test submit
              </Button>
              <Button size="sm" onClick={handlePublish}>
                {settings.published ? "Update" : "Publish"}
              </Button>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="More options"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-40 rounded-xl border border-border/60 bg-background p-1 text-sm shadow-lg">
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-accent"
                      onClick={() => {
                        setMenuOpen(false);
                        void handleDuplicate();
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-accent"
                      onClick={() => {
                        setMenuOpen(false);
                        setResetConfirmOpen(true);
                      }}
                    >
                      Reset to template
                    </button>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-destructive hover:bg-accent"
                      onClick={() => {
                        setMenuOpen(false);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {!handle ? (
        <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
          <CardContent className="py-6 text-sm text-muted-foreground">
            Select a profile handle to edit the lead form.
          </CardContent>
        </Card>
      ) : (
        <>
          {showPreview && (
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <Button
                variant={activeTab === "build" ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveTab("build")}
              >
                Build
              </Button>
              <Button
                variant={activeTab === "preview" ? "default" : "secondary"}
                size="sm"
                onClick={() => setActiveTab("preview")}
              >
                <Smartphone className="mr-2 h-4 w-4" />
                Preview
              </Button>
            </div>
          )}

          <div
            className={cn(
              "grid gap-6",
              showPreview && "lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]"
            )}
          >
            <div
              className={cn(
                showPreview && activeTab === "preview" && "hidden lg:block"
              )}
            >
              <div className="space-y-4">
                <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Templates</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {TEMPLATES.map((template) => (
                      <Button
                        key={template.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-full"
                        onClick={() => handleTemplateSelect(template)}
                      >
                        {template.label}
                      </Button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Fields</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {orderedFields.length ? (
                      orderedFields.map((field, index) => {
                        const expanded = Boolean(expandedFields[field.id]);
                        const advancedOpen = Boolean(advancedFields[field.id]);
                        return (
                          <div
                            key={field.id}
                            className={cn(
                              "rounded-xl border border-border/60 bg-background/80 p-3 transition",
                              selectedFieldId === field.id &&
                                "ring-2 ring-primary/20"
                            )}
                            onClick={() => setSelectedFieldId(field.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-1 text-muted-foreground">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <Input
                                    value={field.label}
                                    onChange={(event) =>
                                      updateField(field.id, {
                                        label: event.target.value,
                                      })
                                    }
                                    className="h-9 text-sm"
                                  />
                                  <span className="rounded-full border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                                    {fieldTypeLabel(field.type)}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                  <label className="flex items-center gap-2">
                                    Required
                                    <Switch
                                      checked={field.required}
                                      onCheckedChange={(value) =>
                                        updateField(field.id, {
                                          required: Boolean(value),
                                        })
                                      }
                                    />
                                  </label>
                                  <label className="flex items-center gap-2">
                                    Enabled
                                    <Switch
                                      checked={field.enabled}
                                      onCheckedChange={(value) =>
                                        updateField(field.id, {
                                          enabled: Boolean(value),
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={index === 0}
                                    onClick={() => moveField(field.id, "up")}
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={index === orderedFields.length - 1}
                                    onClick={() => moveField(field.id, "down")}
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleExpanded(field.id);
                                  }}
                                >
                                  {expanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteField(field.id);
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                            {expanded && (
                              <div className="mt-4 space-y-3 text-sm">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Label
                                    </Label>
                                    <Input
                                      value={field.label}
                                      onChange={(event) =>
                                        updateField(field.id, {
                                          label: event.target.value,
                                        })
                                      }
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Placeholder
                                    </Label>
                                    <Input
                                      value={field.placeholder}
                                      onChange={(event) =>
                                        updateField(field.id, {
                                          placeholder: event.target.value,
                                        })
                                      }
                                      className="h-9 text-sm"
                                    />
                                  </div>
                                </div>

                                {field.type === "select" && (
                                  <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                      Options
                                    </Label>
                                    <div className="space-y-2">
                                      {(field.options || []).map(
                                        (option, optionIndex) => (
                                          <div
                                            key={`${field.id}-option-${optionIndex}`}
                                            className="flex items-center gap-2"
                                          >
                                            <Input
                                              value={option}
                                              onChange={(event) => {
                                                const next = [...field.options];
                                                next[optionIndex] =
                                                  event.target.value;
                                                updateField(field.id, {
                                                  options: next,
                                                });
                                              }}
                                              className="h-9 text-sm"
                                            />
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => {
                                                const next = field.options.filter(
                                                  (_, idx) => idx !== optionIndex
                                                );
                                                updateField(field.id, {
                                                  options: next,
                                                });
                                              }}
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                        )
                                      )}
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() =>
                                          updateField(field.id, {
                                            options: [...field.options, ""],
                                          })
                                        }
                                      >
                                        Add option
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground"
                                  onClick={() => toggleAdvanced(field.id)}
                                >
                                  {advancedOpen ? "Hide" : "Show"} advanced settings
                                  {advancedOpen ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </button>

                                {advancedOpen && (
                                  <div className="space-y-3">
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">
                                          Key
                                        </Label>
                                        <Input
                                          value={field.key}
                                          onChange={(event) =>
                                            updateField(field.id, {
                                              key: normalizeKey(
                                                event.target.value || field.label
                                              ),
                                            })
                                          }
                                          className="h-9 text-sm"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground">
                                          Min length
                                        </Label>
                                        <Input
                                          type="number"
                                          value={field.validation.minLength ?? ""}
                                          onChange={(event) =>
                                            updateField(field.id, {
                                              validation: {
                                                ...field.validation,
                                                minLength: event.target.value
                                                  ? Number(event.target.value)
                                                  : null,
                                              },
                                            })
                                          }
                                          className="h-9 text-sm"
                                        />
                                      </div>
                                    </div>
                                    {field.type === "email" && (
                                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                        Email format
                                        <Switch
                                          checked={Boolean(
                                            field.validation.emailFormat
                                          )}
                                          onCheckedChange={(value) =>
                                            updateField(field.id, {
                                              validation: {
                                                ...field.validation,
                                                emailFormat: Boolean(value),
                                              },
                                            })
                                          }
                                        />
                                      </label>
                                    )}
                                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                      Hidden
                                      <Switch
                                        checked={field.hidden}
                                        onCheckedChange={(value) =>
                                          updateField(field.id, {
                                            hidden: Boolean(value),
                                          })
                                        }
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
                        No fields yet. Select a template or add a field.
                      </div>
                    )}

                    <AddFieldMenu onAdd={handleAddField} />
                  </CardContent>
                </Card>

                <SettingsPanel
                  open={settingsOpen}
                  onToggle={() => setSettingsOpen((prev) => !prev)}
                  settings={settings}
                  onChange={(patch) =>
                    setSettings((prev) => ({ ...prev, ...patch }))
                  }
                />

                <NotificationsPanel
                  open={notificationsOpen}
                  onToggle={() => setNotificationsOpen((prev) => !prev)}
                  settings={settings}
                  onChange={(patch) =>
                    setSettings((prev) => ({ ...prev, ...patch }))
                  }
                />
              </div>
            </div>

            {showPreview && (
              <div
                className={cn(
                  activeTab === "build" && "hidden lg:block",
                  "lg:sticky lg:top-24 lg:self-start"
                )}
              >
                <PhonePreviewCard
                  fields={previewFields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={(fieldId) => {
                    setSelectedFieldId(fieldId);
                    setExpandedFields((prev) => ({
                      ...prev,
                      [fieldId]: true,
                    }));
                  }}
                  settings={settings}
                  previewSuccess={previewSuccess}
                  onResetPreview={() => setPreviewSuccess(false)}
                />
              </div>
            )}
          </div>
        </>
      )}

      <Dialog
        open={templateConfirmOpen}
        onOpenChange={(open) => {
          setTemplateConfirmOpen(open);
          if (!open) setPendingTemplate(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace existing fields?</DialogTitle>
            <DialogDescription>
              This will overwrite your current fields with the selected template.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setTemplateConfirmOpen(false);
                setPendingTemplate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (pendingTemplate) {
                  applyTemplate(pendingTemplate);
                }
                setTemplateConfirmOpen(false);
              }}
            >
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to template?</DialogTitle>
            <DialogDescription>
              This will replace your current fields with the basic contact template.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReset}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete lead form?</DialogTitle>
            <DialogDescription>
              This will remove all fields and settings for this profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test submit</DialogTitle>
            <DialogDescription>
              This will show the success message in the preview without sending a lead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTestModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestSubmit}>Run test</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddFieldMenu({
  onAdd,
}: {
  onAdd: (field: Omit<BuilderField, "id">) => void;
}) {
  const [open, setOpen] = useState(false);

  function handleAdd(field: Omit<BuilderField, "id">) {
    onAdd(field);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        className="w-full rounded-full"
        onClick={() => setOpen((prev) => !prev)}
      >
        + Add field
      </Button>
      {open && (
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Contact</p>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(buildTemplateField("Name", "text", { key: "name" }))
              }
            >
              Name
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(
                  buildTemplateField("Email", "email", {
                    key: "email",
                    required: true,
                  })
                )
              }
            >
              Email
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(buildTemplateField("Phone", "phone", { key: "phone" }))
              }
            >
              Phone
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Business</p>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(buildTemplateField("Company", "text", { key: "company" }))
              }
            >
              Company
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(buildTemplateField("Title", "text", { key: "title" }))
              }
            >
              Title
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(
                  buildTemplateField("Preferred time", "text", {
                    key: "preferred_time",
                  })
                )
              }
            >
              Preferred time
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Intent</p>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(
                  buildTemplateField("Intent", "select", {
                    key: "intent",
                    options: ["Learn more", "Pricing", "Demo"],
                  })
                )
              }
            >
              Select
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(buildTemplateField("Message", "textarea", { key: "message" }))
              }
            >
              Long text
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Custom</p>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(buildTemplateField("Short text", "text", { key: "custom" }))
              }
            >
              Text
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(
                  buildTemplateField("Select", "select", {
                    key: "custom_select",
                    options: ["Option 1", "Option 2"],
                  })
                )
              }
            >
              Select
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                handleAdd(
                  buildTemplateField("Checkbox", "checkbox", {
                    key: "custom_checkbox",
                    placeholder: "Yes",
                  })
                )
              }
            >
              Checkbox
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPanel({
  open,
  onToggle,
  settings,
  onChange,
}: {
  open: boolean;
  onToggle: () => void;
  settings: FormSettings;
  onChange: (patch: Partial<FormSettings>) => void;
}) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Form settings</CardTitle>
        <Button variant="ghost" size="icon" onClick={onToggle}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Submit button text</Label>
            <Input
              value={settings.submitLabel}
              onChange={(event) => onChange({ submitLabel: event.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Success message</Label>
            <Textarea
              value={settings.successMessage}
              onChange={(event) => onChange({ successMessage: event.target.value })}
              rows={2}
              className="min-h-16 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Redirect after submit
            <Switch
              checked={settings.redirectEnabled}
              onCheckedChange={(value) => onChange({ redirectEnabled: Boolean(value) })}
            />
          </label>
          {settings.redirectEnabled && (
            <Input
              value={settings.redirectUrl}
              onChange={(event) => onChange({ redirectUrl: event.target.value })}
              placeholder="https://"
              className="h-9 text-sm"
            />
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Consent checkbox
            <Switch
              checked={settings.consentEnabled}
              onCheckedChange={(value) => onChange({ consentEnabled: Boolean(value) })}
            />
          </label>
          {settings.consentEnabled && (
            <Input
              value={settings.consentLabel}
              onChange={(event) => onChange({ consentLabel: event.target.value })}
              className="h-9 text-sm"
            />
          )}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Spam protection
            <Switch
              checked={settings.spamProtection}
              onCheckedChange={(value) => onChange({ spamProtection: Boolean(value) })}
            />
          </label>
        </CardContent>
      )}
    </Card>
  );
}

function NotificationsPanel({
  open,
  onToggle,
  settings,
  onChange,
}: {
  open: boolean;
  onToggle: () => void;
  settings: FormSettings;
  onChange: (patch: Partial<FormSettings>) => void;
}) {
  return (
    <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold">Notifications</CardTitle>
        <Button variant="ghost" size="icon" onClick={onToggle}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Notify me when someone submits
            <Switch
              checked={settings.notifyEnabled}
              onCheckedChange={(value) => onChange({ notifyEnabled: Boolean(value) })}
            />
          </label>
          {settings.notifyEnabled && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Email
                <Switch
                  checked={settings.notifyEmail}
                  onCheckedChange={(value) => onChange({ notifyEmail: Boolean(value) })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                SMS
                <Switch
                  checked={settings.notifySms}
                  onCheckedChange={(value) => onChange({ notifySms: Boolean(value) })}
                />
              </label>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PhonePreviewCard({
  fields,
  selectedFieldId,
  onSelectField,
  settings,
  previewSuccess,
  onResetPreview,
}: {
  fields: BuilderField[];
  selectedFieldId: string | null;
  onSelectField: (fieldId: string) => void;
  settings: FormSettings;
  previewSuccess: boolean;
  onResetPreview: () => void;
}) {
  return (
    <Card className="rounded-[28px] border border-border/60 bg-card/90 shadow-lg">
      <CardContent className="space-y-4 p-6">
        <div className="rounded-2xl bg-muted/50 px-4 py-2 text-center text-xs uppercase tracking-[0.4em] text-muted-foreground">
          Get in touch
        </div>
        {previewSuccess ? (
          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-center text-sm">
            <p className="font-medium">{settings.successMessage}</p>
            <Button variant="secondary" size="sm" onClick={onResetPreview}>
              Reset preview
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.length ? (
              fields.map((field) => (
                <button
                  type="button"
                  key={field.id}
                  onClick={() => onSelectField(field.id)}
                  className={cn(
                    "w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-left text-sm shadow-sm",
                    selectedFieldId === field.id && "ring-2 ring-primary/30"
                  )}
                >
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {field.label}
                      {field.required ? " (required)" : ""}
                    </div>
                    <PreviewInput field={field} />
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">
                Add fields to see the preview.
              </div>
            )}
            <Button className="w-full rounded-full" disabled>
              {settings.submitLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewInput({ field }: { field: BuilderField }) {
  if (field.type === "textarea") {
    return (
      <Textarea
        rows={2}
        value={field.placeholder || ""}
        readOnly
        className="min-h-16 resize-none text-sm"
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        className="h-10 w-full rounded-xl border border-border/70 bg-muted/60 px-3 text-sm"
        value=""
        disabled
      >
        <option>{field.placeholder || "Select"}</option>
      </select>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" disabled />
        {field.placeholder || "Yes"}
      </label>
    );
  }
  return (
    <Input
      value={field.placeholder || ""}
      readOnly
      className="h-10 text-sm"
    />
  );
}

function fieldTypeLabel(type: FieldType) {
  switch (type) {
    case "email":
      return "Email";
    case "phone":
      return "Phone";
    case "textarea":
      return "Long text";
    case "select":
      return "Select";
    case "checkbox":
      return "Checkbox";
    default:
      return "Text";
  }
}

function buildTemplateField(
  label: string,
  type: FieldType,
  overrides: Partial<Omit<BuilderField, "id">> = {}
): Omit<BuilderField, "id"> {
  return ensureFieldDefaults({
    key: overrides.key || normalizeKey(label),
    label,
    type,
    required: false,
    enabled: true,
    hidden: false,
    placeholder: "",
    options: [],
    validation: {},
    ...overrides,
  });
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function ensureFieldDefaults(field: Omit<BuilderField, "id">): Omit<BuilderField, "id"> {
  return {
    key: field.key || normalizeKey(field.label || "field"),
    label: field.label || "Field",
    type: field.type ?? "text",
    required: Boolean(field.required),
    enabled: field.enabled !== false,
    hidden: Boolean(field.hidden),
    placeholder: field.placeholder || "",
    options: field.options || [],
    validation: field.validation || {},
  };
}

function ensureUniqueKeys(fields: BuilderField[]) {
  const used = new Set<string>();
  return fields.map((field) => {
    const base = normalizeKey(field.key || field.label || "field");
    let nextKey = base || "field";
    let counter = 1;
    while (used.has(nextKey)) {
      nextKey = `${base || "field"}_${counter}`;
      counter += 1;
    }
    used.add(nextKey);
    return { ...field, key: nextKey };
  });
}

function mapFieldFromDb(field: LeadField): BuilderField {
  return {
    id: field.id,
    key: field.key || normalizeKey(field.label),
    label: field.label,
    type: field.type,
    required: field.required,
    enabled: field.is_active,
    hidden: Boolean(field.is_hidden),
    placeholder: field.placeholder || "",
    options: field.options || [],
    validation: field.validation || {},
  };
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
