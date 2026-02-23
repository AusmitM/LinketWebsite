import "server-only";

import { getConfiguredSiteOrigin } from "@/lib/site-url";
import { BUNDLE_RENEWAL_REMINDER_WINDOW_DAYS } from "@/lib/billing/plans";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";

type ReminderCandidate = {
  id: string;
  user_id: string;
  ends_at: string | null;
  email_prompted_at: string | null;
};

function isMissingRelationError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendRenewalReminderEmail(params: {
  to: string;
  daysRemaining: number;
  entitlementEndDate: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { status: "skipped" as const };

  const from =
    process.env.BILLING_FROM ||
    process.env.CONSULTS_FROM ||
    process.env.LEADS_FROM ||
    "onboarding@resend.dev";
  const siteOrigin = getConfiguredSiteOrigin();
  const billingUrl = `${siteOrigin}/dashboard/billing`;
  const subject = "Your Linket Pro bundle ends soon";

  const safeDate = escapeHtml(params.entitlementEndDate);
  const safeDays = escapeHtml(String(params.daysRemaining));
  const safeBillingUrl = escapeHtml(billingUrl);

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;">
      <h2>${subject}</h2>
      <p>Your included 12-month Pro access from the Web + Linket Bundle ends in <strong>${safeDays} day(s)</strong>.</p>
      <p><strong>End date:</strong> ${safeDate}</p>
      <p>Pick your renewal plan to keep Pro active:</p>
      <p><a href="${safeBillingUrl}">Manage billing and choose monthly or yearly Pro</a></p>
    </div>
  `;

  const text = [
    subject,
    "",
    `Your included Pro access ends in ${params.daysRemaining} day(s).`,
    `End date: ${params.entitlementEndDate}`,
    `Choose your renewal plan: ${billingUrl}`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend error: ${body || response.status}`);
  }

  return { status: "sent" as const };
}

async function getReminderCandidates(windowDays: number) {
  if (!isSupabaseAdminAvailable) return [];
  const now = new Date();
  const threshold = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from("billing_entitlements")
    .select("id,user_id,ends_at,email_prompted_at")
    .eq("plan_key", "bundle_59")
    .eq("status", "active")
    .is("email_prompted_at", null)
    .gte("ends_at", now.toISOString())
    .lte("ends_at", threshold.toISOString())
    .order("ends_at", { ascending: true })
    .limit(200);

  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }

  return (data ?? []) as ReminderCandidate[];
}

async function markEmailReminderSent(entitlementId: string) {
  const { error } = await supabaseAdmin
    .from("billing_entitlements")
    .update({
      email_prompted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", entitlementId)
    .is("email_prompted_at", null);
  if (error && !isMissingRelationError(error)) {
    throw new Error(error.message);
  }
}

export async function runBundleRenewalReminderSweep(
  windowDays = BUNDLE_RENEWAL_REMINDER_WINDOW_DAYS
) {
  if (!isSupabaseAdminAvailable) {
    return {
      scanned: 0,
      reminded: 0,
      skipped: 0,
      errors: ["Supabase admin client is unavailable."],
    };
  }

  const candidates = await getReminderCandidates(windowDays);
  let reminded = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      if (!candidate.ends_at) {
        skipped += 1;
        continue;
      }

      const userResult = await supabaseAdmin.auth.admin.getUserById(candidate.user_id);
      const userEmail = userResult.data.user?.email ?? null;
      if (!userEmail) {
        skipped += 1;
        continue;
      }

      const daysRemaining = Math.max(
        0,
        Math.ceil((Date.parse(candidate.ends_at) - Date.now()) / (24 * 60 * 60 * 1000))
      );
      await sendRenewalReminderEmail({
        to: userEmail,
        daysRemaining,
        entitlementEndDate: candidate.ends_at,
      });
      await markEmailReminderSent(candidate.id);
      reminded += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown reminder failure";
      errors.push(`${candidate.id}: ${message}`);
    }
  }

  return {
    scanned: candidates.length,
    reminded,
    skipped,
    errors,
  };
}

