import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseAdminAvailable } from "@/lib/supabase-admin";
import { getAccountByHandle, getActiveProfileForUser } from "@/lib/profile-service";

export const dynamic = "force-dynamic";

type LeadPayload = {
  user_id: string;
  handle: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  source_url?: string | null;
  honeypot?: string | null;
};

export async function POST(req: NextRequest) {
  let body: LeadPayload | null = null;
  try {
    body = (await req.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body) return NextResponse.json({ error: "Missing body" }, { status: 400 });

  // Honeypot: if set, silently accept without sending
  if (body.honeypot && String(body.honeypot).trim().length > 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "honeypot" });
  }

  const userId = (body.user_id || "").trim();
  const handle = (body.handle || "").trim();
  const name = (body.name || "").trim().slice(0, 200);
  const email = (body.email || "").trim().slice(0, 320);
  const phone = (body.phone || "").trim().slice(0, 64) || null;
  const company = (body.company || "").trim().slice(0, 160) || null;
  const message = (body.message || "").trim().slice(0, 4000) || null;
  const sourceUrl = (body.source_url || "").trim().slice(0, 2048) || null;

  if (!userId || !handle || !name || !email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Look up owner email from auth by user_id
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEADS_FROM || process.env.CONTACT_FROM || "onboarding@resend.dev";
  const toOverride = process.env.LEADS_TO || process.env.CONTACT_TO || null;

  // Verify the account + active profile exist for the provided handle
  try {
    const account = handle ? await getAccountByHandle(handle) : null;
    if (!account || account.user_id !== userId) {
      console.warn("[leads/notify] No matching account for", { userId, handle });
    } else {
      const activeProfile = await getActiveProfileForUser(account.user_id);
      if (!activeProfile) {
        console.warn("[leads/notify] No active profile for", { userId, handle });
      }
    }
  } catch (error) {
    console.warn("[leads/notify] account lookup failed", error);
  }

  let ownerEmail: string | null = null;
  if (isSupabaseAdminAvailable) {
    try {
      const u = await supabaseAdmin.auth.admin.getUserById(userId);
      ownerEmail = (u.data.user?.email as string | null) || null;
    } catch (e) {
      console.warn("[leads/notify] admin.getUserById failed", e);
    }
  }

  const to = toOverride || ownerEmail;
  if (!to) {
    // Nothing to notify; accept the request anyway.
    return NextResponse.json({ ok: true, skipped: true, reason: "no-destination" });
  }

  if (!apiKey) {
    console.warn("[leads/notify] RESEND_API_KEY not set. Skipping send.", { to, from, name, email, handle });
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const subject = `New lead for @${handle}: ${name}`;
    const textLines = [
      `New lead on your public page (@${handle})`,
      `Name: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      company ? `Company: ${company}` : null,
      message ? `\nMessage:\n${message}` : null,
      sourceUrl ? `\nSource: ${sourceUrl}` : null,
    ].filter(Boolean) as string[];
    const text = textLines.join("\n");
    const html = `<!doctype html><html><body>
      <h2 style="margin:0 0 10px;">New lead for @${escapeHtml(handle)}</h2>
      <table style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;">
        <tr><td style="padding:2px 8px 2px 0;">Name</td><td><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding:2px 8px 2px 0;">Email</td><td><a href="mailto:${escapeAttr(email)}">${escapeHtml(email)}</a></td></tr>
        ${phone ? `<tr><td style=\"padding:2px 8px 2px 0;\">Phone</td><td>${escapeHtml(phone)}</td></tr>` : ""}
        ${company ? `<tr><td style=\"padding:2px 8px 2px 0;\">Company</td><td>${escapeHtml(company)}</td></tr>` : ""}
        ${sourceUrl ? `<tr><td style=\"padding:2px 8px 2px 0;\">Source</td><td><a href=\"${escapeAttr(sourceUrl)}\">${escapeHtml(sourceUrl)}</a></td></tr>` : ""}
      </table>
      ${message ? `<div style=\"margin-top:12px;\"><div style=\"font-weight:600;\">Message</div><pre style=\"white-space:pre-wrap;\">${escapeHtml(message)}</pre></div>` : ""}
    </body></html>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, text, html }),
    });

    if (!resp.ok) {
      const info = await safeJson(resp);
      console.error("[leads/notify] Resend error", resp.status, info);
      if (resp.status === 401 || resp.status === 403) {
        return NextResponse.json({ ok: true, skipped: true, reason: "invalid-api-key" });
      }
      return NextResponse.json({ error: "Failed to send" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[leads/notify] Send error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}

async function safeJson(resp: Response) {
  try {
    return await resp.json();
  } catch {
    return await resp.text();
  }
}
