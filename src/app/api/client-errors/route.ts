import { NextRequest, NextResponse } from "next/server";
import { forwardClientErrorToSentry } from "@/lib/sentry-forwarder";

type ClientErrorBody = {
  message?: string;
  name?: string | null;
  stack?: string | null;
  source?: string | null;
  componentStack?: string | null;
  level?: "error" | "warning";
  href?: string | null;
  userAgent?: string | null;
  timestamp?: string | null;
};

function sanitize(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ClientErrorBody;
    const message = sanitize(body.message, 2000);
    if (!message) {
      return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
    }

    const payload = {
      message,
      name: sanitize(body.name, 180) || null,
      stack: sanitize(body.stack, 12000) || null,
      source: sanitize(body.source, 500) || null,
      componentStack: sanitize(body.componentStack, 12000) || null,
      level: body.level === "warning" ? "warning" : "error",
      href: sanitize(body.href, 1024) || null,
      userAgent: sanitize(body.userAgent, 512) || null,
      timestamp: sanitize(body.timestamp, 80) || null,
    } as const;

    console.error("Client error captured", {
      name: payload.name || "Error",
      message: payload.message,
      source: payload.source,
      href: payload.href,
    });

    try {
      await forwardClientErrorToSentry(payload);
    } catch (error) {
      console.warn(
        "Client error forwarding failed:",
        error instanceof Error ? error.message : "unknown"
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to process client error" },
      { status: 500 }
    );
  }
}
