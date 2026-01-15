"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/system/toaster";
import type { LeadFormConfig, LeadFormSubmission } from "@/types/lead-form";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];

type ContactPickerContact = {
  name?: string[];
  email?: string[];
  tel?: string[];
  organization?: string[];
};

type ContactPicker = {
  select: (
    properties: Array<"name" | "email" | "tel" | "organization">,
    options?: { multiple?: boolean }
  ) => Promise<ContactPickerContact[]>;
};

function getFirst(value?: string[] | null) {
  if (!value || !value.length) return "";
  return value[0] ?? "";
}

function buildAnswers(form: LeadFormConfig, contact: ContactPickerContact) {
  const name = getFirst(contact.name);
  const email = getFirst(contact.email);
  const phone = getFirst(contact.tel);
  const company = getFirst(contact.organization);
  const answers: LeadFormSubmission["answers"] = {};

  for (const field of form.fields) {
    if (field.type === "section") continue;
    const label = field.label.toLowerCase();
    if (name && !answers[field.id] && label.includes("name")) {
      answers[field.id] = { value: name };
      continue;
    }
    if (email && !answers[field.id] && label.includes("email")) {
      answers[field.id] = { value: email };
      continue;
    }
    if (phone && !answers[field.id] && label.includes("phone")) {
      answers[field.id] = { value: phone };
      continue;
    }
    if (company && !answers[field.id] && label.includes("company")) {
      answers[field.id] = { value: company };
      continue;
    }
  }

  return { answers, responderEmail: email || null };
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

  React.useEffect(() => {
    const picker = (navigator as Navigator & { contacts?: ContactPicker })
      .contacts;
    setSupported(Boolean(picker?.select));
  }, []);

  async function shareContact() {
    const picker = (navigator as Navigator & { contacts?: ContactPicker })
      .contacts;
    if (!picker?.select) {
      if (typeof document !== "undefined") {
        document.getElementById("public-lead-form")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
      toast({
        title: "Share contact",
        description: "Fill out the form below to share your contact.",
      });
      return;
    }
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

      const contacts = await picker.select(["name", "email", "tel", "organization"], {
        multiple: false,
      });
      const contact = contacts[0];
      if (!contact) return;

      const { answers, responderEmail } = buildAnswers(payload.form, contact);
      if (!Object.keys(answers).length) {
        toast({
          title: "Contact not shared",
          description: "No matching fields were found for this form.",
          variant: "destructive",
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to share contact";
      toast({
        title: "Contact not shared",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSharing(false);
    }
  }

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
