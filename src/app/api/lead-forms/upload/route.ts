import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseReadonly } from "@/lib/supabase/server";
import { isSupabaseAdminAvailable, supabaseAdmin } from "@/lib/supabase-admin";
import { limitRequest } from "@/lib/rate-limit";
import type {
  LeadFormConfig,
  LeadFormFileUploadField,
  LeadFormUploadedFile,
} from "@/types/lead-form";

const UPLOAD_BUCKET = "lead-form-uploads";

type LeadFormRow = {
  id: string;
  user_id: string;
  status: "draft" | "published";
  config: LeadFormConfig;
};

export async function POST(request: NextRequest) {
  try {
    if (await limitRequest(request, "lead-form-upload", 30, 60_000)) {
      return NextResponse.json(
        { error: "Too many upload attempts. Please try again later." },
        { status: 429 }
      );
    }

    if (!isSupabaseAdminAvailable) {
      return NextResponse.json(
        { error: "File uploads are not configured." },
        { status: 503 }
      );
    }

    const data = await request.formData();
    const formId = String(data.get("formId") ?? "").trim();
    const fieldId = String(data.get("fieldId") ?? "").trim();
    const fileEntry = data.get("file");

    if (!formId || !fieldId || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "formId, fieldId, and file are required." },
        { status: 400 }
      );
    }

    if (fileEntry.size <= 0) {
      return NextResponse.json(
        { error: "File is empty." },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseReadonly();
    const { data: formRow, error: formError } = await supabase
      .from("lead_forms")
      .select("id,user_id,status,config")
      .eq("id", formId)
      .maybeSingle();
    if (formError) throw new Error(formError.message);
    if (!formRow) {
      return NextResponse.json({ error: "Form not found." }, { status: 404 });
    }

    const typedFormRow = formRow as LeadFormRow;
    if (typedFormRow.status !== "published") {
      return NextResponse.json(
        { error: "Form not available." },
        { status: 403 }
      );
    }

    const field = typedFormRow.config.fields.find((item) => item.id === fieldId);
    if (!field || field.type !== "file_upload") {
      return NextResponse.json(
        { error: "File upload field not found." },
        { status: 400 }
      );
    }

    const uploadField = field as LeadFormFileUploadField;
    const maxBytes = Math.max(1, uploadField.maxSizeMB) * 1024 * 1024;
    if (fileEntry.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max ${uploadField.maxSizeMB} MB.` },
        { status: 400 }
      );
    }

    if (!matchesAcceptedType(fileEntry, uploadField.acceptedTypes)) {
      return NextResponse.json(
        { error: "File type not allowed." },
        { status: 400 }
      );
    }

    const path = buildUploadPath(
      typedFormRow.user_id,
      typedFormRow.id,
      fieldId,
      fileEntry.name
    );

    const { error: uploadError } = await supabaseAdmin.storage
      .from(UPLOAD_BUCKET)
      .upload(path, fileEntry, {
        cacheControl: "3600",
        upsert: false,
        contentType: fileEntry.type || undefined,
      });
    if (uploadError) {
      throw new Error(uploadError.message || "Upload failed.");
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(UPLOAD_BUCKET)
      .getPublicUrl(path);

    const payload: LeadFormUploadedFile = {
      name: fileEntry.name,
      path,
      url: publicData?.publicUrl ?? null,
      sizeBytes: fileEntry.size,
      mimeType: fileEntry.type || null,
    };

    return NextResponse.json({ file: payload });
  } catch (error) {
    console.error("Lead form upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to upload file.",
      },
      { status: 500 }
    );
  }
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

function buildUploadPath(
  userId: string,
  formId: string,
  fieldId: string,
  originalFileName: string
) {
  const extension = extractFileExtension(originalFileName);
  const baseName = sanitizeFileName(
    originalFileName.replace(/\.[^.]+$/, "")
  );
  const safeFormId = sanitizeFileName(formId);
  const safeFieldId = sanitizeFileName(fieldId);
  const unique = randomId();
  const fileName = extension
    ? `${safeFormId}-${safeFieldId}-${Date.now()}-${unique}-${baseName}.${extension}`
    : `${safeFormId}-${safeFieldId}-${Date.now()}-${unique}-${baseName}`;
  return `${userId}/${fileName}`;
}

function sanitizeFileName(value: string) {
  const ascii = value.normalize("NFKD").replace(/[^\x00-\x7F]/g, "");
  const safe = ascii
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe.slice(0, 80) || "file";
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    const id = (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.();
    if (id) return id.replace(/-/g, "").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}
