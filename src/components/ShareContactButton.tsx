"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/system/toaster";
import type { LeadFormConfig, LeadFormSubmission } from "@/types/lead-form";
import { trackEvent } from "@/lib/analytics";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];

type ContactPickerContact = {
  name?: string[];
  email?: string[];
  tel?: string[];
  organization?: string[];
  icon?: Array<Blob | string>;
};

type ContactPicker = {
  select: (
    properties: ContactProperty[],
    options?: { multiple?: boolean }
  ) => Promise<ContactPickerContact[]>;
  getProperties?: () => Promise<ContactProperty[]>;
};

const CONTACT_PROPERTIES = [
  "name",
  "email",
  "tel",
  "organization",
  "icon",
] as const;
type ContactProperty = (typeof CONTACT_PROPERTIES)[number];
const DEFAULT_PROPERTIES: ContactProperty[] = ["name", "email", "tel"];
const PHOTO_LABELS = ["photo", "avatar", "headshot", "picture", "image"];
const COMPANY_LABELS = ["company", "organization", "org"];
const TITLE_LABELS = ["title", "job", "position", "role"];
const MAX_PHOTO_BYTES = 220 * 1024;

function getFirst(value?: string[] | null) {
  if (!value || !value.length) return "";
  return value[0] ?? "";
}

function matchesLabel(label: string, needles: string[]) {
  return needles.some((needle) => label.includes(needle));
}

function buildAnswers(form: LeadFormConfig, contact: ContactPickerContact) {
  const fullName = getFirst(contact.name);
  const email = getFirst(contact.email);
  const phone = getFirst(contact.tel);
  const answers: LeadFormSubmission["answers"] = {};
  const orgs = contact.organization ?? [];
  const company = getFirst(orgs);
  const title =
    orgs.length > 1 ? orgs.find((value, index) => index > 0) ?? "" : "";
  const normalizedName = fullName.trim().replace(/\s+/g, " ");
  const [firstName, ...rest] = normalizedName ? normalizedName.split(" ") : [];
  const lastName = rest.join(" ");

  for (const field of form.fields) {
    if (field.type === "section") continue;
    const label = field.label.toLowerCase();
    if (!answers[field.id]) {
      if (firstName && label.includes("first") && label.includes("name")) {
        answers[field.id] = { value: firstName };
        continue;
      }
      if (lastName && label.includes("last") && label.includes("name")) {
        answers[field.id] = { value: lastName };
        continue;
      }
      if (normalizedName && label.includes("name")) {
        answers[field.id] = { value: normalizedName };
        continue;
      }
      if (email && label.includes("email")) {
        answers[field.id] = { value: email };
        continue;
      }
      if (phone && (label.includes("phone") || label.includes("mobile"))) {
        answers[field.id] = { value: phone };
        continue;
      }
      if (company && matchesLabel(label, COMPANY_LABELS)) {
        answers[field.id] = { value: company };
        continue;
      }
      if (title && matchesLabel(label, TITLE_LABELS)) {
        answers[field.id] = { value: title };
        continue;
      }
    }
  }

  return { answers, responderEmail: email || null };
}

async function resolvePickerProperties(picker: ContactPicker) {
  if (typeof picker.getProperties !== "function") {
    return DEFAULT_PROPERTIES;
  }
  try {
    const supported = await picker.getProperties();
    if (!Array.isArray(supported) || !supported.length) {
      return DEFAULT_PROPERTIES;
    }
    const properties = CONTACT_PROPERTIES.filter((prop) =>
      supported.includes(prop)
    );
    return properties.length ? properties : DEFAULT_PROPERTIES;
  } catch {
    return DEFAULT_PROPERTIES;
  }
}

function getPhotoFieldId(form: LeadFormConfig) {
  for (const field of form.fields) {
    if (field.type === "section") continue;
    if (field.type !== "short_text" && field.type !== "long_text") continue;
    const label = field.label.toLowerCase();
    if (matchesLabel(label, PHOTO_LABELS)) return field.id;
  }
  return null;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

async function buildPhotoAnswer(
  form: LeadFormConfig,
  contact: ContactPickerContact
) {
  const fieldId = getPhotoFieldId(form);
  if (!fieldId) return null;
  const icon = contact.icon?.[0];
  if (!icon) return null;
  if (typeof icon === "string") {
    return icon ? { fieldId, value: icon } : null;
  }
  if (icon.size > MAX_PHOTO_BYTES) return null;
  const dataUrl = await readBlobAsDataUrl(icon);
  if (!dataUrl) return null;
  return { fieldId, value: dataUrl };
}

export default function ShareContactButton({
  handle,
  label = "Share contact",
  className,
  variant,
}: {
  handle: string;
  label?: string;
  className?: string;
  variant?: ButtonVariant;
}) {
  const [sharing, setSharing] = React.useState(false);
  const [supported, setSupported] = React.useState(false);
  const [isIOS, setIsIOS] = React.useState(false);

  React.useEffect(() => {
    const picker = (navigator as Navigator & { contacts?: ContactPicker })
      .contacts;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setIsIOS(/iP(hone|od|ad)/.test(ua));
    setSupported(Boolean(picker?.select));
  }, []);

  async function shareContact() {
    const picker = (navigator as Navigator & { contacts?: ContactPicker })
      .contacts;
    if (!picker?.select) return;
    void trackEvent("share_contact_click", { handle });
    try {
      setSharing(true);
      const response = await fetch(
        `/api/lead-forms/public?handle=${encodeURIComponent(handle)}`,
        { cache: "no-store" }
      );
      if (!response.ok) {
        const info = await response.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to load lead form");
      }
      const payload = (await response.json()) as {
        form: LeadFormConfig | null;
        formId?: string | null;
      };
      if (!payload.form || !payload.formId) {
        throw new Error("Lead form unavailable");
      }

      const properties = await resolvePickerProperties(picker);
      const contacts = await picker.select(properties, {
        multiple: false,
      });
      const contact = contacts[0];
      if (!contact) return;

      const { answers, responderEmail } = buildAnswers(payload.form, contact);
      const photoAnswer = await buildPhotoAnswer(payload.form, contact);
      if (photoAnswer) {
        answers[photoAnswer.fieldId] = { value: photoAnswer.value };
      }
      if (!Object.keys(answers).length) {
        toast({
          title: "Contact not shared",
          description: "No matching fields were found for this form.",
          variant: "destructive",
        });
        await trackEvent("share_contact_failed", {
          handle,
          reason: "no_matching_fields",
        });
        return;
      }

      const submitRes = await fetch("/api/lead-forms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: payload.formId,
          answers,
          responderEmail,
        }),
      });
      if (!submitRes.ok) {
        const info = await submitRes.json().catch(() => ({}));
        throw new Error(info?.error || "Unable to share contact");
      }

      toast({
        title: "Contact shared",
        description: "Your contact was sent to the Linket owner.",
        variant: "success",
      });
      await trackEvent("share_contact_success", { handle });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to share contact";
      toast({
        title: "Contact not shared",
        description: message,
        variant: "destructive",
      });
      await trackEvent("share_contact_failed", {
        handle,
        reason: message.slice(0, 160),
      });
    } finally {
      setSharing(false);
    }
  }

  if (!supported || isIOS) return null;

  return (
    <Button
      onClick={shareContact}
      disabled={sharing}
      aria-label={label}
      title={label}
      className={className}
      variant={variant}
    >
      {sharing ? "Preparing..." : label}
    </Button>
  );
}
