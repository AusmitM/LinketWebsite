"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/system/toaster";
import { trackEvent } from "@/lib/analytics";

type ConsultFormState = {
  workEmail: string;
  teamSize: string;
  notes: string;
  website: string;
};

const INITIAL_STATE: ConsultFormState = {
  workEmail: "",
  teamSize: "",
  notes: "",
  website: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConsultForm() {
  const [form, setForm] = useState(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const updateField =
    (field: keyof ConsultFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const workEmail = form.workEmail.trim();
    const teamSize = form.teamSize.trim();
    const notes = form.notes.trim();
    const website = form.website.trim();

    if (website) {
      setSubmitted(true);
      setForm(INITIAL_STATE);
      await trackEvent("consult_submit_honeypot", { source: "landing_consult" });
      return;
    }

    if (!workEmail || !EMAIL_RE.test(workEmail)) {
      setError("Please enter a valid work email.");
      return;
    }
    if (!teamSize) {
      setError("Please share your team size.");
      return;
    }
    if (!notes) {
      setError("Please add a few notes so we can prepare.");
      return;
    }

    setSubmitting(true);
    void trackEvent("consult_submit_attempt", {
      source: "landing_consult",
      hasNotes: notes.length > 0,
    });
    try {
      const response = await fetch("/api/consult", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workEmail,
          teamSize,
          notes,
          pageUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to send request.");
      }

      toast({
        title: "Request sent",
        description: "We will reach out within one business day.",
        variant: "success",
      });
      setSubmitted(true);
      setForm(INITIAL_STATE);
      await trackEvent("consult_submit_success", {
        source: "landing_consult",
        teamSize,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to send request.";
      setError(message);
      toast({ title: "Something went wrong", description: message });
      await trackEvent("consult_submit_failed", {
        source: "landing_consult",
        message: message.slice(0, 160),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="custom-website" className="sr-only">
          Website
        </label>
        <input
          id="custom-website"
          type="text"
          value={form.website}
          onChange={updateField("website")}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
          className="hidden"
        />
      </div>
      <div>
        <label
          htmlFor="custom-email"
          className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
        >
          Work email
        </label>
        <input
          id="custom-email"
          type="email"
          value={form.workEmail}
          onChange={updateField("workEmail")}
          autoComplete="email"
          required
          disabled={submitting}
          className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#ff9776] focus:outline-none focus:ring-2 focus:ring-[#ff9776]/40"
          placeholder="name@company.com"
        />
      </div>
      <div>
        <label
          htmlFor="custom-team"
          className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
        >
          Team size
        </label>
        <input
          id="custom-team"
          type="text"
          value={form.teamSize}
          onChange={updateField("teamSize")}
          required
          disabled={submitting}
          className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#5dd6f7] focus:outline-none focus:ring-2 focus:ring-[#5dd6f7]/40"
          placeholder="e.g. 25 reps"
        />
      </div>
      <div>
        <label
          htmlFor="custom-notes"
          className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50"
        >
          Notes
        </label>
        <textarea
          id="custom-notes"
          rows={3}
          value={form.notes}
          onChange={updateField("notes")}
          required
          disabled={submitting}
          className="mt-2 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-[#ff9776] focus:outline-none focus:ring-2 focus:ring-[#ff9776]/40"
          placeholder="Share timelines or hardware goals..."
        />
      </div>
      <Button
        type="submit"
        disabled={submitting || submitted}
        data-analytics-id="consult_submit_click"
        data-analytics-meta='{"source":"landing_consult"}'
        className="w-full rounded-2xl bg-gradient-to-r from-[#ff9776] via-[#ffb866] to-[#5dd6f7] text-base font-semibold text-slate-900 shadow-[0_15px_45px_rgba(255,151,118,0.35)] disabled:opacity-70"
      >
        {submitted ? "Request sent" : "Book your consult"}
      </Button>
      {error ? (
        <p className="text-center text-xs text-red-200">{error}</p>
      ) : (
        <p className="text-center text-xs text-white/50">
          We reply within one business day.
        </p>
      )}
    </form>
  );
}
