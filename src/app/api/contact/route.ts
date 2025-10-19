import { NextRequest, NextResponse } from "next/server";

type ContactPayload = {
  name: string;
  email: string;
  message: string;
};

export async function POST(req: NextRequest) {
  let body: ContactPayload;
  try {
    body = (await req.json()) as ContactPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body?.name || "").trim();
  const email = (body?.email || "").trim();
  const message = (body?.message || "").trim();
  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const to = process.env.CONTACT_TO || "punit@peridotkonda.com";
  const from = process.env.CONTACT_FROM || "onboarding@resend.dev";
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // No provider configured; pretend success to avoid blocking UX during development.
    console.warn("[contact] RESEND_API_KEY not set. Skipping send. Message:", { name, email, message });
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const subject = `New contact message from ${name}`;
    const text = `From: ${name} <${email}>\n\n${message}`;
    const html = `<!doctype html><html><body><p><strong>From:</strong> ${name} &lt;${email}&gt;</p><pre style="white-space:pre-wrap;">${escapeHtml(
      message
    )}</pre></body></html>`;

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
      console.error("[contact] Resend error", resp.status, info);
      if (resp.status === 401 || resp.status === 403) {
        return NextResponse.json({ ok: true, skipped: true, reason: "invalid-api-key" });
      }
      return NextResponse.json({ error: "Failed to send" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[contact] Send error", e);
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

async function safeJson(r: Response) {
  try {
    return await r.json();
  } catch {
    return await r.text();
  }
}

