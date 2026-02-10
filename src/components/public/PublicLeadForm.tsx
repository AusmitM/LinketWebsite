"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/system/toaster";
import { emitAnalyticsEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  shuffleFields,
  shuffleOptions,
  validateSubmission,
} from "@/lib/lead-form";
import type {
  LeadFormCheckboxGridField,
  LeadFormCheckboxesField,
  LeadFormConfig,
  LeadFormDropdownField,
  LeadFormField,
  LeadFormFileUploadField,
  LeadFormMultipleChoiceField,
  LeadFormMultipleChoiceGridField,
  LeadFormRatingField,
  LeadFormUploadedFile,
} from "@/types/lead-form";

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
  initialForm?: LeadFormConfig | null;
  initialFormId?: string | null;
  appearance?: Appearance;
  variant?: "card" | "profile";
  showHeader?: boolean;
  className?: string;
};

type AnswerMap = Record<string, { value: unknown }>;
type PendingUploadMap = Record<string, File[]>;
type MicrophonePermissionState =
  | "unknown"
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported";
type BrowserFamily =
  | "safari"
  | "chrome"
  | "google"
  | "opera"
  | "edge"
  | "yahoo"
  | "unknown";

type ErrorMap = Record<string, string>;

const OTHER_VALUE = "__other__";
const OTHER_PREFIX = "other:";
const AUDIO_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "wav",
  "aac",
  "ogg",
  "webm",
  "opus",
]);

export default function PublicLeadForm({
  handle,
  initialForm = null,
  initialFormId = null,
  appearance,
  variant = "card",
  showHeader = true,
  className,
}: Props) {
  const hydratedFormId = initialFormId ?? initialForm?.id ?? null;
  const [form, setForm] = useState<LeadFormConfig | null>(initialForm);
  const [formId, setFormId] = useState<string | null>(hydratedFormId);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [pendingUploads, setPendingUploads] = useState<PendingUploadMap>({});
  const [errors, setErrors] = useState<ErrorMap>({});
  const [loading, setLoading] = useState(!initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [editingResponse, setEditingResponse] = useState(false);
  const [recordingFieldId, setRecordingFieldId] = useState<string | null>(null);
  const [audioRecordingSupported, setAudioRecordingSupported] = useState(false);
  const [microphonePermission, setMicrophonePermission] =
    useState<MicrophonePermissionState>("unknown");
  const [browserFamily, setBrowserFamily] = useState<BrowserFamily>("unknown");
  const [recordedAudioPreviews, setRecordedAudioPreviews] = useState<
    Record<string, string>
  >({});

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingTargetFieldRef = useRef<LeadFormFileUploadField | null>(null);
  const previewUrlsRef = useRef<Record<string, string>>({});

  const disabled = !form || form.status !== "published";
  const hasFields = Boolean(form?.fields?.length);

  const cardStyle = appearance
    ? {
        background: appearance.cardBackground,
        borderColor: appearance.cardBorder,
        color: appearance.text,
      }
    : undefined;
  const mutedStyle = appearance ? { color: appearance.muted } : undefined;
  const fieldBaseClassName =
    variant === "profile"
      ? "border-border/70 bg-input text-foreground placeholder:text-muted-foreground shadow-sm"
      : "";
  const inputClassName =
    variant === "profile"
      ? cn("h-10 rounded-xl px-3 text-sm", fieldBaseClassName)
      : "";
  const textareaClassName =
    variant === "profile"
      ? cn("min-h-20 rounded-xl px-3 py-2 text-sm", fieldBaseClassName)
      : "";
  const buttonClassName = cn(
    variant === "profile"
      ? "w-fit rounded-full px-5 py-1.5 text-sm shadow-[0_10px_24px_-18px_var(--ring)]"
      : "rounded-2xl",
    "text-foreground"
  );
  const cardClassName = cn(
    "border border-border/60",
    showHeader ? null : "gap-0 py-4",
    variant === "profile" ? "py-4" : null,
    className
  );

  useEffect(() => {
    if (!handle) return;
    const hasHydratedForm = Boolean(initialForm && hydratedFormId);
    if (!hasHydratedForm) {
      setLoading(true);
    }
    (async () => {
      try {
        const response = await fetch(
          `/api/lead-forms/public?handle=${encodeURIComponent(handle)}`,
          { cache: "no-store" }
        );
        if (!response.ok) {
          const info = await response.json().catch(() => ({}));
          throw new Error(info?.error || "Unable to load form");
        }
        const payload = (await response.json()) as {
          form: LeadFormConfig | null;
          formId?: string;
        };
        const nextFormId = payload.formId ?? payload.form?.id ?? null;
        setForm(payload.form);
        setFormId(nextFormId);
      } catch (error) {
        if (hasHydratedForm) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "Lead form unavailable";
        toast({
          title: "Lead form unavailable",
          description: message,
          variant: "destructive",
        });
        setForm(null);
        setFormId(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [handle, hydratedFormId, initialForm]);

  useEffect(() => {
    if (!formId) return;
    try {
      const savedResponseId = localStorage.getItem(`lead-form-response:${formId}`);
      if (savedResponseId) setResponseId(savedResponseId);
    } catch {
      // Ignore storage failures (private browsing / restricted storage).
    }
  }, [formId]);

  useEffect(() => {
    if (!form) return;
    setAnswers((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const initial: AnswerMap = {};
      form.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          initial[field.id] = { value: field.defaultValue };
        }
      });
      return initial;
    });
  }, [form]);

  useEffect(() => {
    if (!form) return;
    if (form.settings.limitOneResponse === "on" && responseId) {
      setSubmitted(true);
    }
  }, [form, responseId]);

  useEffect(() => {
    const supported = isAudioRecordingSupported();
    setAudioRecordingSupported(supported);
    setBrowserFamily(detectBrowserFamily());
    if (!supported) {
      setMicrophonePermission("unsupported");
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.permissions ||
      typeof navigator.permissions.query !== "function"
    ) {
      setMicrophonePermission("unknown");
      return;
    }

    let cancelled = false;
    let statusRef: PermissionStatus | null = null;

    const sync = (state: PermissionState) => {
      if (cancelled) return;
      setMicrophonePermission(permissionStateToMicrophoneState(state));
    };

    void navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        statusRef = status;
        sync(status.state);
        status.onchange = () => sync(status.state);
      })
      .catch(() => {
        if (!cancelled) {
          setMicrophonePermission("unknown");
        }
      });

    return () => {
      cancelled = true;
      if (statusRef) {
        statusRef.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    previewUrlsRef.current = recordedAudioPreviews;
  }, [recordedAudioPreviews]);

  useEffect(() => {
    return () => {
      stopActiveRecorder(false);
      Object.values(previewUrlsRef.current).forEach((url) =>
        URL.revokeObjectURL(url)
      );
    };
  }, []);

  const orderedFields = useMemo(() => {
    if (!form) return [];
    return form.settings.shuffleQuestionOrder
      ? shuffleFields(form.fields)
      : form.fields;
  }, [form]);
  const emailField = useMemo(() => {
    if (!form) return null;
    return form.fields.find((field) => isEmailField(field)) ?? null;
  }, [form]);
  const emailAnswer = emailField ? answers[emailField.id]?.value : null;
  const emailValue =
    typeof emailAnswer === "string" ? emailAnswer.trim() : "";
  const shouldCaptureResponderEmail =
    Boolean(emailField) && form?.settings.collectEmail !== "off";

  const progress = useMemo(() => {
    if (!form || !form.settings.showProgressBar) return null;
    const fields = form.fields.filter((field) => field.type !== "section");
    if (!fields.length) return null;
    const answered = fields.filter((field) =>
      hasValue(answers[field.id]?.value)
    ).length;
    return Math.round((answered / fields.length) * 100);
  }, [answers, form]);

  if (!loading && (disabled || !hasFields)) {
    return null;
  }

  function setAnswer(fieldId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [fieldId]: { value } }));
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function getAnswer(fieldId: string) {
    return answers[fieldId]?.value;
  }

  function setPendingUploadFiles(fieldId: string, files: File[]) {
    setPendingUploads((prev) => {
      if (!files.length) {
        if (!(fieldId in prev)) return prev;
        const next = { ...prev };
        delete next[fieldId];
        return next;
      }
      return { ...prev, [fieldId]: files };
    });
  }

  function stopActiveRecorder(updateState = true) {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingTargetFieldRef.current = null;
    if (updateState) {
      setRecordingFieldId(null);
    }
  }

  function clearRecordingPreview(fieldId: string) {
    setRecordedAudioPreviews((prev) => {
      const existing = prev[fieldId];
      if (!existing) return prev;
      URL.revokeObjectURL(existing);
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function clearSelectedFiles(fieldId: string) {
    setPendingUploadFiles(fieldId, []);
    clearRecordingPreview(fieldId);
    setAnswer(fieldId, []);
  }

  function stopVoiceRecording(fieldId: string) {
    if (
      mediaRecorderRef.current &&
      recordingTargetFieldRef.current?.id === fieldId &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  function clearFieldError(fieldId: string) {
    setErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  async function requestMicrophoneStream(fieldId: string) {
    const supportedNow = isAudioRecordingSupported();
    if (supportedNow !== audioRecordingSupported) {
      setAudioRecordingSupported(supportedNow);
    }
    if (!supportedNow) {
      setMicrophonePermission("unsupported");
      setErrors((prev) => ({
        ...prev,
        [fieldId]: "Microphone recording requires HTTPS (or localhost) and a supported browser.",
      }));
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophonePermission("granted");
      clearFieldError(fieldId);
      return stream;
    } catch (error) {
      await handleMicrophoneAccessError(error, fieldId);
      return null;
    }
  }

  async function handleMicrophoneAccessError(error: unknown, fieldId: string) {
    const domError =
      error instanceof DOMException
        ? error
        : error && typeof error === "object" && "name" in error
        ? (error as DOMException)
        : null;
    const errorName = domError?.name || "";
    const permissionState = await readMicrophonePermissionState();
    if (permissionState && permissionState !== microphonePermission) {
      setMicrophonePermission(permissionState);
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setMicrophonePermission("unsupported");
      setErrors((prev) => ({
        ...prev,
        [fieldId]: "Microphone recording requires HTTPS (or localhost).",
      }));
      return;
    }

    if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
      if (permissionState === "prompt" || permissionState === "unknown") {
        setErrors((prev) => ({
          ...prev,
          [fieldId]:
            "Microphone prompt was dismissed. Click Record voice memo and choose Allow when prompted.",
        }));
        return;
      }
      setMicrophonePermission("denied");
      setErrors((prev) => ({
        ...prev,
        [fieldId]: getMicrophoneBlockedMessage(browserFamily),
      }));
      return;
    }

    if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
      setMicrophonePermission("unknown");
      setErrors((prev) => ({
        ...prev,
        [fieldId]: "No microphone was found on this device.",
      }));
      return;
    }

    if (errorName === "NotReadableError" || errorName === "TrackStartError") {
      setMicrophonePermission("unknown");
      setErrors((prev) => ({
        ...prev,
        [fieldId]: "Microphone is busy. Close other apps using it and try again.",
      }));
      return;
    }

    if (errorName === "NotSupportedError") {
      setMicrophonePermission("unsupported");
      setErrors((prev) => ({
        ...prev,
        [fieldId]: "Microphone recording requires HTTPS (or localhost).",
      }));
      return;
    }

    setMicrophonePermission("unknown");
    setErrors((prev) => ({
      ...prev,
      [fieldId]:
        "Unable to access microphone right now. Please try again.",
    }));
  }

  async function startVoiceRecording(field: LeadFormFileUploadField) {
    if (recordingFieldId && recordingFieldId !== field.id) {
      setErrors((prev) => ({
        ...prev,
        [recordingFieldId]: "Stop the current recording first.",
      }));
      return;
    }
    if (mediaRecorderRef.current || mediaStreamRef.current) {
      stopActiveRecorder();
    }

    const stream = await requestMicrophoneStream(field.id);
    if (!stream) return;
    try {
      const mimeType = pickRecordingMimeType(field.acceptedTypes);
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const targetField = { ...field };

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingTargetFieldRef.current = targetField;
      recordingChunksRef.current = [];
      setRecordingFieldId(field.id);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setErrors((prev) => ({
          ...prev,
          [targetField.id]: "Unable to record audio.",
        }));
      };

      recorder.onstop = () => {
        const capturedChunks = recordingChunksRef.current.slice();
        const usedField = recordingTargetFieldRef.current;
        stopActiveRecorder();
        if (!usedField) return;
        if (capturedChunks.length === 0) {
          setErrors((prev) => ({
            ...prev,
            [usedField.id]: "No audio captured. Please try again.",
          }));
          return;
        }

        const blobType = recorder.mimeType || "audio/webm";
        const blob = new Blob(capturedChunks, { type: blobType });
        const maxBytes = usedField.maxSizeMB * 1024 * 1024;
        if (blob.size > maxBytes) {
          setErrors((prev) => ({
            ...prev,
            [usedField.id]: `Recording is too large. Max ${usedField.maxSizeMB} MB.`,
          }));
          return;
        }

        const extension =
          extensionFromMimeType(blob.type) ||
          firstAudioExtension(usedField.acceptedTypes) ||
          "webm";
        const fileName = buildVoiceMemoFileName(extension);
        const recordedFile = new File([blob], fileName, {
          type: blob.type || "audio/webm",
        });

        clearRecordingPreview(usedField.id);
        const previewUrl = URL.createObjectURL(blob);
        setRecordedAudioPreviews((prev) => ({
          ...prev,
          [usedField.id]: previewUrl,
        }));
        setPendingUploadFiles(usedField.id, [recordedFile]);
        setAnswer(usedField.id, [recordedFile.name]);
      };

      recorder.start(250);
    } catch (error) {
      stopActiveRecorder();
      await handleMicrophoneAccessError(error, field.id);
    }
  }

  async function uploadFilesForField(
    field: LeadFormFileUploadField,
    currentFormId: string
  ): Promise<LeadFormUploadedFile[] | null> {
    const files = pendingUploads[field.id];
    if (!files?.length) return null;

    const uploads = files.map(async (file) => {
      const data = new FormData();
      data.append("formId", currentFormId);
      data.append("fieldId", field.id);
      data.append("file", file);

      const response = await fetch("/api/lead-forms/upload", {
        method: "POST",
        body: data,
      });
      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info?.error || `Unable to upload ${file.name}`);
      }

      const payload = (await response.json()) as { file?: LeadFormUploadedFile };
      if (!payload.file) {
        throw new Error(`Unable to upload ${file.name}`);
      }
      return payload.file;
    });

    return Promise.all(uploads);
  }

  async function prepareAnswersForSubmit(
    currentForm: LeadFormConfig,
    currentFormId: string
  ) {
    const nextAnswers: AnswerMap = { ...answers };
    const uploadedFieldIds: string[] = [];

    for (const field of currentForm.fields) {
      if (field.type !== "file_upload") continue;
      const uploaded = await uploadFilesForField(field, currentFormId);
      if (!uploaded) continue;
      nextAnswers[field.id] = { value: uploaded };
      uploadedFieldIds.push(field.id);
    }

    return { nextAnswers, uploadedFieldIds };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form || !formId) return;
    if (recordingFieldId) {
      setErrors((prev) => ({
        ...prev,
        [recordingFieldId]: "Stop recording before submitting.",
      }));
      toast({
        title: "Recording in progress",
        description: "Stop the voice memo recording before submitting.",
        variant: "destructive",
      });
      return;
    }
    if (
      form.settings.limitOneResponse === "on" &&
      responseId &&
      !form.settings.allowEditAfterSubmit
    ) {
      toast({
        title: "Already submitted",
        description: "Only one response is allowed.",
        variant: "destructive",
      });
      return;
    }
    if (form.settings.collectEmail === "verified" && emailField && !emailValue) {
      setErrors((prev) => ({
        ...prev,
        [emailField.id]: "Email is required.",
      }));
      return;
    }

    const validationErrors = validateSubmission(form, answers);
    if (validationErrors.length) {
      const nextErrors: ErrorMap = {};
      validationErrors.forEach((err) => {
        nextErrors[err.fieldId] = err.message;
      });
      setErrors(nextErrors);
      toast({
        title: "Missing info",
        description: "Please fix the highlighted fields.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const { nextAnswers, uploadedFieldIds } = await prepareAnswersForSubmit(
        form,
        formId
      );
      if (uploadedFieldIds.length > 0) {
        setAnswers(nextAnswers);
        setPendingUploads((prev) => {
          const next = { ...prev };
          uploadedFieldIds.forEach((fieldId) => {
            delete next[fieldId];
          });
          return next;
        });
      }
      const shouldEdit =
        editingResponse &&
        form.settings.allowEditAfterSubmit &&
        Boolean(responseId);
      const endpoint = shouldEdit
          ? "/api/lead-forms/response"
          : "/api/lead-forms/submit";
      const method = endpoint === "/api/lead-forms/response" ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId,
          responseId: shouldEdit ? responseId : undefined,
          answers: nextAnswers,
          responderEmail: shouldCaptureResponderEmail ? emailValue || null : null,
          pageUrl: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        const message = info?.error || "Unable to submit";
        if (info?.fields) {
          const nextErrors: ErrorMap = {};
          info.fields.forEach((err: { fieldId: string; message: string }) => {
            nextErrors[err.fieldId] = err.message;
          });
          setErrors(nextErrors);
        }
        throw new Error(message);
      }
      const payload = (await response.json()) as { responseId?: string };
      const nextResponseId = payload.responseId ?? responseId;
      if (nextResponseId) {
        try {
          localStorage.setItem(`lead-form-response:${formId}`, nextResponseId);
        } catch {
          // Ignore storage failures (private browsing / restricted storage).
        }
        setResponseId(nextResponseId);
      }
      emitAnalyticsEvent({
        id: shouldEdit ? "lead_form_response_updated" : "lead_form_response_submitted",
        meta: {
          formId,
          handle,
          mode: shouldEdit ? "edit" : "create",
        },
      });
      setEditingResponse(false);
      setSubmitted(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit";
      toast({ title: "Submit failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  function renderOptions(
    field: LeadFormMultipleChoiceField | LeadFormCheckboxesField | LeadFormDropdownField,
    options?: { describedBy?: string; hasError?: boolean; required?: boolean }
  ) {
    const describedBy = options?.describedBy;
    const hasError = options?.hasError;
    const required = options?.required;
    const optionIds = field.options.map((option) => option.id);
    const orderedOptions = field.presentation?.shuffleOptions
      ? shuffleOptions(field.options)
      : field.options;
    const value = getAnswer(field.id);
    const hasOther =
      field.allowOther &&
      typeof value === "string" &&
      value.startsWith(OTHER_PREFIX);
    const otherValue =
      hasOther && typeof value === "string"
        ? value.slice(OTHER_PREFIX.length)
        : "";

    if (field.type === "dropdown") {
      return (
        <div className="space-y-2">
          <select
            id={field.id}
            className={cn(
              "h-10 w-full rounded-md border border-border bg-background px-3 text-sm",
              inputClassName
            )}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            value={
              typeof value === "string"
                ? optionIds.includes(value)
                  ? value
                  : field.allowOther && value.startsWith(OTHER_PREFIX)
                  ? OTHER_VALUE
                  : ""
                : ""
            }
            onChange={(event) => {
              const next = event.target.value;
              if (next === OTHER_VALUE) {
                setAnswer(field.id, `${OTHER_PREFIX}${otherValue}`);
              } else {
                setAnswer(field.id, next);
              }
            }}
            disabled={disabled || submitting}
          >
            <option value="">Select...</option>
            {orderedOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
            {field.allowOther ? <option value={OTHER_VALUE}>Other</option> : null}
          </select>
          {field.allowOther && hasOther ? (
            <div>
              <Input
                value={otherValue}
                onChange={(event) =>
                  setAnswer(field.id, `${OTHER_PREFIX}${event.target.value}`)
                }
                placeholder={field.otherLabel || "Other"}
                className={inputClassName}
                disabled={disabled || submitting}
              />
            </div>
          ) : null}
        </div>
      );
    }

    if (field.type === "multiple_choice") {
      return (
        <div className="space-y-2">
          {orderedOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.id}
                value={option.id}
                checked={value === option.id}
                onChange={() => setAnswer(field.id, option.id)}
                disabled={disabled || submitting}
              />
              <span>{option.label}</span>
            </label>
          ))}
          {field.allowOther ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.id}
                value={OTHER_VALUE}
                checked={hasOther}
                onChange={() =>
                  setAnswer(field.id, `${OTHER_PREFIX}${otherValue}`)
                }
                disabled={disabled || submitting}
              />
              <span>{field.otherLabel || "Other"}</span>
              {hasOther ? (
                <Input
                  value={otherValue}
                  onChange={(event) =>
                    setAnswer(field.id, `${OTHER_PREFIX}${event.target.value}`)
                  }
                  className={cn("h-9", inputClassName)}
                  disabled={disabled || submitting}
                />
              ) : null}
            </label>
          ) : null}
        </div>
      );
    }

    if (field.type === "checkboxes") {
      const selected = Array.isArray(value) ? value.slice() : [];
      const otherSelected = selected.find(
        (item) => typeof item === "string" && item.startsWith(OTHER_PREFIX)
      );
      const otherText =
        typeof otherSelected === "string"
          ? otherSelected.slice(OTHER_PREFIX.length)
          : "";
      return (
        <div className="space-y-2">
          {orderedOptions.map((option) => (
            <label key={option.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={option.id}
                checked={selected.includes(option.id)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, option.id]
                    : selected.filter((item) => item !== option.id);
                  setAnswer(field.id, next);
                }}
                disabled={disabled || submitting}
              />
              <span>{option.label}</span>
            </label>
          ))}
          {field.allowOther ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={OTHER_VALUE}
                checked={Boolean(otherSelected)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selected, `${OTHER_PREFIX}${otherText}`]
                    : selected.filter((item) => item !== otherSelected);
                  setAnswer(field.id, next);
                }}
                disabled={disabled || submitting}
              />
              <span>{field.otherLabel || "Other"}</span>
              {otherSelected ? (
                <Input
                  value={otherText}
                  onChange={(event) => {
                    const next = event.target.value;
                    const withoutOther = selected.filter(
                      (item) => item !== otherSelected
                    );
                    setAnswer(field.id, [
                      ...withoutOther,
                      `${OTHER_PREFIX}${next}`,
                    ]);
                  }}
                  className={cn("h-9", inputClassName)}
                  disabled={disabled || submitting}
                />
              ) : null}
            </label>
          ) : null}
        </div>
      );
    }

    return null;
  }

  function renderRating(field: LeadFormRatingField) {
    const value = Number(getAnswer(field.id) || 0);
    const icon = field.icon === "heart" ? "H" : field.icon === "thumbs" ? "T" : "*";
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: field.scale }, (_, index) => {
          const score = index + 1;
          return (
            <label key={score} className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name={field.id}
                value={score}
                checked={value === score}
                onChange={() => setAnswer(field.id, score)}
                disabled={disabled || submitting}
              />
              <span aria-hidden="true">{icon}</span>
              <span>{score}</span>
            </label>
          );
        })}
      </div>
    );
  }

  function renderLinearScale(field: LeadFormField) {
    if (field.type !== "linear_scale") return null;
    const value = Number(getAnswer(field.id) || 0);
    const items = [];
    for (let i = field.min; i <= field.max; i += 1) items.push(i);
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {items.map((score) => (
            <label key={score} className="flex items-center gap-1 text-sm">
              <input
                type="radio"
                name={field.id}
                value={score}
                checked={value === score}
                onChange={() => setAnswer(field.id, score)}
                disabled={disabled || submitting}
              />
              <span>{score}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{field.minLabel}</span>
          <span>{field.maxLabel}</span>
        </div>
      </div>
    );
  }

  function renderGrid(field: LeadFormMultipleChoiceGridField | LeadFormCheckboxGridField) {
    const value = (getAnswer(field.id) as Record<string, unknown>) || {};
    const rows = field.rows;
    const columns = field.columns;
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th
                className="border-b border-border/60 p-2 text-left"
                scope="col"
                aria-hidden="true"
              />
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="border-b border-border/60 p-2 text-left font-medium"
                  scope="col"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <th
                  className="border-b border-border/60 p-2 text-left font-medium"
                  scope="row"
                >
                  {row.label}
                </th>
                {columns.map((column) => {
                  const rowValue = value?.[row.id];
                  const checked =
                    field.type === "multiple_choice_grid"
                      ? rowValue === column.id
                      : Array.isArray(rowValue) && rowValue.includes(column.id);
                  return (
                    <td key={column.id} className="border-b border-border/60 p-2 text-center">
                      <input
                        type={field.type === "multiple_choice_grid" ? "radio" : "checkbox"}
                        name={`${field.id}-${row.id}`}
                        value={column.id}
                        checked={checked}
                        onChange={(event) => {
                          if (field.type === "multiple_choice_grid") {
                            setAnswer(field.id, { ...value, [row.id]: column.id });
                            return;
                          }
                          const nextRow = Array.isArray(rowValue) ? rowValue.slice() : [];
                          const next = event.target.checked
                            ? [...nextRow, column.id]
                            : nextRow.filter((item) => item !== column.id);
                          setAnswer(field.id, { ...value, [row.id]: next });
                        }}
                        disabled={disabled || submitting}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderField(field: LeadFormField) {
    if (field.type === "section") {
      return (
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{field.title}</h3>
          {field.description ? (
            <p className="text-sm text-muted-foreground">{field.description}</p>
          ) : null}
        </div>
      );
    }

    const error = errors[field.id];
    const hasError = Boolean(error);
    const helpText = field.helpText?.trim();
    const helpId = helpText ? `${field.id}-help` : undefined;
    const isGroupField = [
      "multiple_choice",
      "checkboxes",
      "linear_scale",
      "rating",
      "multiple_choice_grid",
      "checkbox_grid",
    ].includes(field.type);
    const isVoiceMemoField =
      field.type === "file_upload" && isAudioRecordingField(field);
    const blockedMicrophoneMessage =
      isVoiceMemoField && audioRecordingSupported && microphonePermission === "denied"
        ? getMicrophoneBlockedMessage(browserFamily)
        : null;
    const showErrorText = Boolean(
      error && (!blockedMicrophoneMessage || error !== blockedMicrophoneMessage)
    );
    const errorId = showErrorText ? `${field.id}-error` : undefined;
    const describedBy =
      [helpId, errorId].filter(Boolean).join(" ") || undefined;
    const labelId = `${field.id}-label`;
    const label = isGroupField ? (
      <Label id={labelId} className="text-sm font-medium">
        {field.label}
        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
    ) : (
      <Label htmlFor={field.id} className="text-sm font-medium">
        {field.label}
        {field.required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
    );
    const errorText = showErrorText ? (
      <p id={errorId} className="text-xs text-destructive" role="alert">
        {error}
      </p>
    ) : null;
    const groupProps = isGroupField
      ? {
          role: "group",
          "aria-labelledby": labelId,
          "aria-describedby": describedBy,
          "aria-invalid": hasError || undefined,
          "aria-required": field.required || undefined,
        }
      : {};

    return (
      <div className="space-y-2" {...groupProps}>
        {label}
        {helpText ? (
          <p id={helpId} className="sr-only">
            {helpText}
          </p>
        ) : null}
        {field.type === "short_text" ? (
          <Input
            id={field.id}
            value={(getAnswer(field.id) as string) || ""}
            onChange={(event) => {
              const nextValue = event.target.value;
              setAnswer(
                field.id,
                isPhoneField(field) ? formatPhoneNumber(nextValue) : nextValue
              );
            }}
            type={isPhoneField(field) ? "tel" : isEmailField(field) ? "email" : "text"}
            inputMode={isPhoneField(field) ? "tel" : undefined}
            placeholder={field.helpText || undefined}
            className={inputClassName}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={field.required || undefined}
            disabled={disabled || submitting}
          />
        ) : null}
        {field.type === "long_text" ? (
          <Textarea
            id={field.id}
            value={(getAnswer(field.id) as string) || ""}
            onChange={(event) => setAnswer(field.id, event.target.value)}
            placeholder={field.helpText || undefined}
            className={textareaClassName}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={field.required || undefined}
            disabled={disabled || submitting}
          />
        ) : null}
        {field.type === "multiple_choice" ||
        field.type === "checkboxes" ||
        field.type === "dropdown"
          ? renderOptions(field, {
              describedBy,
              hasError,
              required: field.required,
            })
          : null}
        {field.type === "linear_scale" ? renderLinearScale(field) : null}
        {field.type === "rating" ? renderRating(field) : null}
        {field.type === "date" ? (
          <Input
            id={field.id}
            type={field.includeTime ? "datetime-local" : "date"}
            value={(getAnswer(field.id) as string) || ""}
            onChange={(event) => setAnswer(field.id, event.target.value)}
            placeholder={field.helpText || undefined}
            className={inputClassName}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={field.required || undefined}
            disabled={disabled || submitting}
          />
        ) : null}
        {field.type === "time" ? (
          <Input
            id={field.id}
            type={field.mode === "time_of_day" ? "time" : "number"}
            value={(getAnswer(field.id) as string) || ""}
            onChange={(event) => setAnswer(field.id, event.target.value)}
            className={inputClassName}
            min={field.mode === "duration" ? 0 : undefined}
            step={field.mode === "time_of_day" ? field.stepMinutes * 60 : field.stepMinutes}
            placeholder={
              field.helpText ||
              (field.mode === "duration" ? "Minutes" : undefined)
            }
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={field.required || undefined}
            disabled={disabled || submitting}
          />
        ) : null}
        {field.type === "file_upload" ? (
          <div className="space-y-2">
            {isVoiceMemoField ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={recordingFieldId === field.id ? "destructive" : "secondary"}
                    size="sm"
                    onClick={() => {
                      if (recordingFieldId === field.id) {
                        stopVoiceRecording(field.id);
                        return;
                      }
                      void startVoiceRecording(field);
                    }}
                    disabled={
                      disabled ||
                      submitting ||
                      (Boolean(recordingFieldId) && recordingFieldId !== field.id)
                    }
                  >
                    {recordingFieldId === field.id
                      ? "Stop recording"
                      : "Record voice memo"}
                  </Button>
                  {getFileAnswerNames(getAnswer(field.id)).length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => clearSelectedFiles(field.id)}
                      disabled={disabled || submitting || recordingFieldId === field.id}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
                {!audioRecordingSupported ? (
                  <p className="text-xs text-muted-foreground">
                    Voice memo recording is not available in this browser.
                  </p>
                ) : null}
                {blockedMicrophoneMessage ? (
                  <p className="text-xs text-destructive" role="alert">
                    {blockedMicrophoneMessage}
                  </p>
                ) : null}
                {recordingFieldId === field.id ? (
                  <p className="text-xs text-muted-foreground">
                    Recording... click stop when finished.
                  </p>
                ) : null}
                {recordedAudioPreviews[field.id] ? (
                  <audio
                    controls
                    src={recordedAudioPreviews[field.id]}
                    className="w-full"
                  />
                ) : null}
              </div>
            ) : null}
            {!isVoiceMemoField ? (
              <Input
                id={field.id}
                type="file"
                multiple={field.maxFiles > 1}
                accept={toAcceptAttribute(field.acceptedTypes)}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (files.length > field.maxFiles) {
                    setPendingUploadFiles(field.id, []);
                    setAnswer(field.id, []);
                    setErrors((prev) => ({
                      ...prev,
                      [field.id]: `Max ${field.maxFiles} files.`,
                    }));
                    return;
                  }
                  const maxBytes = field.maxSizeMB * 1024 * 1024;
                  const invalid = files.find((file) => file.size > maxBytes);
                  if (invalid) {
                    setPendingUploadFiles(field.id, []);
                    setAnswer(field.id, []);
                    setErrors((prev) => ({
                      ...prev,
                      [field.id]: `File too large. Max ${field.maxSizeMB} MB.`,
                    }));
                    return;
                  }
                  const invalidType = files.find(
                    (file) => !matchesAcceptedType(file, field.acceptedTypes)
                  );
                  if (invalidType) {
                    setPendingUploadFiles(field.id, []);
                    setAnswer(field.id, []);
                    setErrors((prev) => ({
                      ...prev,
                      [field.id]: "File type not allowed.",
                    }));
                    return;
                  }
                  clearRecordingPreview(field.id);
                  setPendingUploadFiles(field.id, files);
                  setAnswer(
                    field.id,
                    files.map((file) => file.name)
                  );
                }}
                className={inputClassName}
                aria-invalid={hasError || undefined}
                aria-describedby={describedBy}
                aria-required={field.required || undefined}
                disabled={disabled || submitting || recordingFieldId === field.id}
              />
            ) : null}
            {getFileAnswerNames(getAnswer(field.id)).length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {getFileAnswerNames(getAnswer(field.id)).join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {field.type === "multiple_choice_grid" ||
        field.type === "checkbox_grid"
          ? renderGrid(field)
          : null}
        {errorText}
      </div>
    );
  }

  if (loading || disabled) return null;

  if (submitted && form) {
    return (
      <Card
        className={cn("border border-border/60", className)}
        style={cardStyle}
      >
        <CardHeader>
          <CardTitle>Thanks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground" style={mutedStyle}>
            {form.settings.confirmationMessage}
          </p>
          {form.settings.allowEditAfterSubmit ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingResponse(true);
                setSubmitted(false);
              }}
              className={buttonClassName}
            >
              Edit response
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cardClassName} style={cardStyle}>
      {showHeader ? (
        <CardHeader className="space-y-2">
          <CardTitle>{form?.title || "Lead capture"}</CardTitle>
          {form?.description ? (
            <p className="text-sm text-muted-foreground" style={mutedStyle}>
              {form.description}
            </p>
          ) : null}
          {typeof progress === "number" ? (
            <div>
              <div
                className="h-2 w-full rounded-full bg-muted"
                role="progressbar"
                aria-label="Form completion"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {progress}% complete
              </div>
            </div>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent>
        {!showHeader && typeof progress === "number" ? (
          <div className="mb-4">
            <div
              className="h-2 w-full rounded-full bg-muted"
              role="progressbar"
              aria-label="Form completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {progress}% complete
            </div>
          </div>
        ) : null}
        <form className="space-y-5" onSubmit={handleSubmit}>
          {orderedFields.map((field) => (
            <div key={field.id}>{renderField(field)}</div>
          ))}

          <div className="pt-2">
            <Button
              type="submit"
              disabled={disabled || submitting || Boolean(recordingFieldId)}
              variant={appearance?.buttonVariant ?? "default"}
              className={buttonClassName}
            >
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function isAudioRecordingSupported() {
  if (typeof window === "undefined") return false;
  if (typeof navigator === "undefined") return false;
  if (typeof MediaRecorder === "undefined") return false;
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

function permissionStateToMicrophoneState(
  state: PermissionState
): MicrophonePermissionState {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  if (state === "prompt") return "prompt";
  return "unknown";
}

async function readMicrophonePermissionState(): Promise<MicrophonePermissionState | null> {
  if (typeof navigator === "undefined") return null;
  if (!navigator.permissions || typeof navigator.permissions.query !== "function") {
    return null;
  }
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return permissionStateToMicrophoneState(status.state);
  } catch {
    return null;
  }
}

function detectBrowserFamily(): BrowserFamily {
  if (typeof navigator === "undefined") return "unknown";
  const ua = (navigator.userAgent || "").toLowerCase();

  if (
    ua.includes("yahoo") ||
    ua.includes("yahoomobile") ||
    ua.includes("yabrowser")
  ) {
    return "yahoo";
  }
  if (ua.includes("edg/") || ua.includes("edge/")) {
    return "edge";
  }
  if (ua.includes("opr/") || ua.includes("opera")) {
    return "opera";
  }
  if (ua.includes("gsa/") || ua.includes("googleapp")) {
    return "google";
  }
  if (ua.includes("chrome/") || ua.includes("crios/")) {
    return "chrome";
  }
  if (ua.includes("safari/")) {
    return "safari";
  }
  return "unknown";
}

function getMicrophoneBlockedMessage(browser: BrowserFamily) {
  switch (browser) {
    case "safari":
      return "Microphone blocked in Safari. Tap aA in the address bar, open Website Settings, allow Microphone, then click Record voice memo again.";
    case "chrome":
      return "Microphone blocked in Chrome. Click the lock icon, open Site settings, allow Microphone, then click Record voice memo again.";
    case "google":
      return "Microphone blocked in Google browser. Open site permissions, allow Microphone, then click Record voice memo again.";
    case "opera":
      return "Microphone blocked in Opera. Click the lock icon, open Site settings, allow Microphone, then click Record voice memo again.";
    case "edge":
      return "Microphone blocked in Edge. Click the lock icon, open Permissions for this site, allow Microphone, then click Record voice memo again.";
    case "yahoo":
      return "Microphone blocked in Yahoo browser. Open site settings, allow Microphone, then click Record voice memo again.";
    default:
      return "Microphone is blocked. Use browser site settings to allow it, then click Record voice memo again.";
  }
}

function isAudioRecordingField(field: LeadFormFileUploadField) {
  const acceptedTypes = field.acceptedTypes
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (acceptedTypes.length === 0) return false;
  return acceptedTypes.every((value) => isAudioAcceptType(value));
}

function isAudioAcceptType(value: string) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes("/")) return normalized.startsWith("audio/");
  return AUDIO_EXTENSIONS.has(normalized.replace(/^\./, ""));
}

function pickRecordingMimeType(acceptedTypes: string[]) {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = buildAudioMimeCandidates(acceptedTypes);
  for (const mimeType of candidates) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return "";
}

function buildAudioMimeCandidates(acceptedTypes: string[]) {
  const out = new Set<string>();
  acceptedTypes.forEach((value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return;
    if (normalized.includes("/")) {
      if (normalized.endsWith("/*")) return;
      out.add(normalized);
      return;
    }
    const mime = audioMimeFromExtension(normalized.replace(/^\./, ""));
    if (mime) out.add(mime);
  });

  out.add("audio/webm;codecs=opus");
  out.add("audio/webm");
  out.add("audio/ogg;codecs=opus");
  out.add("audio/ogg");
  out.add("audio/mpeg");
  out.add("audio/mp4");
  out.add("audio/wav");
  return Array.from(out);
}

function audioMimeFromExtension(extension: string) {
  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "aac":
      return "audio/aac";
    case "ogg":
      return "audio/ogg";
    case "webm":
      return "audio/webm";
    case "opus":
      return "audio/ogg;codecs=opus";
    default:
      return "";
  }
}

function extensionFromMimeType(mimeType: string) {
  const normalized = String(mimeType ?? "").toLowerCase();
  if (normalized.includes("audio/mpeg")) return "mp3";
  if (normalized.includes("audio/mp4")) return "m4a";
  if (normalized.includes("audio/wav")) return "wav";
  if (normalized.includes("audio/aac")) return "aac";
  if (normalized.includes("audio/ogg")) return "ogg";
  if (normalized.includes("audio/webm")) return "webm";
  if (normalized.includes("audio/opus")) return "opus";
  return "";
}

function firstAudioExtension(acceptedTypes: string[]) {
  for (const value of acceptedTypes) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) continue;
    if (normalized.includes("/")) {
      const mapped = extensionFromMimeType(normalized);
      if (mapped) return mapped;
      continue;
    }
    const extension = normalized.replace(/^\./, "");
    if (AUDIO_EXTENSIONS.has(extension)) return extension;
  }
  return "";
}

function buildVoiceMemoFileName(extension: string) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `voice-memo-${stamp}.${extension}`;
}

function getFileAnswerNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      if (!entry || typeof entry !== "object") return "";
      const maybeFile = entry as { name?: unknown };
      return typeof maybeFile.name === "string" ? maybeFile.name.trim() : "";
    })
    .filter(Boolean);
}

function toAcceptAttribute(acceptedTypes: string[]) {
  const values = acceptedTypes
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => {
      if (entry.includes("/") || entry.startsWith(".")) return entry;
      return `.${entry}`;
    });
  return values.join(",");
}

function matchesAcceptedType(file: File, acceptedTypes: string[]) {
  const normalized = normalizeAcceptedTypes(acceptedTypes);
  if (!normalized.extensions.length && !normalized.mimes.length) return true;

  const fileType = (file.type || "").toLowerCase();
  const extension = extractFileExtension(file.name);

  const mimeMatch = normalized.mimes.some((mime) => {
    if (mime.endsWith("/*")) {
      const prefix = mime.slice(0, mime.length - 1);
      return fileType.startsWith(prefix);
    }
    return fileType === mime;
  });
  if (mimeMatch) return true;

  if (!extension) return false;
  return normalized.extensions.includes(extension);
}

function normalizeAcceptedTypes(values: string[]) {
  const extensions = new Set<string>();
  const mimes = new Set<string>();

  values.forEach((value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return;
    if (normalized.includes("/")) {
      mimes.add(normalized);
      return;
    }
    extensions.add(normalized.replace(/^\./, ""));
  });

  return {
    extensions: Array.from(extensions),
    mimes: Array.from(mimes),
  };
}

function extractFileExtension(fileName: string) {
  const normalized = String(fileName ?? "").trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === normalized.length - 1) return "";
  return normalized.slice(lastDot + 1);
}

function hasValue(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value).some((entry) => {
      if (Array.isArray(entry)) return entry.length > 0;
      return entry != null && String(entry).trim().length > 0;
    });
  }
  return true;
}

function isPhoneField(field: LeadFormField) {
  if (field.type !== "short_text") return false;
  return field.label.toLowerCase().includes("phone");
}

function isEmailField(field: LeadFormField) {
  if (field.type !== "short_text") return false;
  if (field.validation?.rule === "email") return true;
  return field.label.toLowerCase().includes("email");
}

function formatPhoneNumber(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 10);
  if (!digits) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)} - ${digits.slice(6)}`;
}
