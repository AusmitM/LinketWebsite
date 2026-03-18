import { NextResponse } from "next/server";
import { z } from "zod";

function toIssueMessage(error: z.ZodError) {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "request";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function validateSearchParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T
) {
  const input = Object.fromEntries(searchParams.entries());
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: toIssueMessage(parsed.error) || "Invalid query string." },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true as const,
    data: parsed.data,
  };
}

export async function validateJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
) {
  const body = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: toIssueMessage(parsed.error) || "Invalid request body." },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true as const,
    data: parsed.data,
  };
}

export const uuidParamSchema = z.string().uuid();
