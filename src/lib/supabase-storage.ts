// src/lib/supabase-storage.ts
"use client";

import { supabase } from "@/lib/supabase";
import { appendVersion } from "@/lib/avatar-utils";

export type UploadResult = { publicUrl: string; thumbUrl: string; path: string; thumbPath: string };
export type HeaderUploadResult = { publicUrl: string; path: string };
export type LogoUploadResult = { publicUrl: string; path: string };

/**
 * Upload an avatar to the `avatars` bucket.
 * - Max 2MB
 * - Accepts png/jpg/jpeg
 * Returns a public URL if successful.
 */
export async function uploadAvatar(
  file: File,
  userId: string
): Promise<UploadResult> {
  if (!file) throw new Error("No file selected");
  if (file.size > 5 * 1024 * 1024) throw new Error("File too large (max 5MB)");

  const type = (file.type || "").toLowerCase();
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"]; 
  if (!ok.includes(type)) {
    throw new Error("Only PNG, JPG or WEBP images allowed");
  }

  // Convert to WebP in the browser (reduces bandwidth + storage)
  const webpFile = await toWebP(file, 512).catch(() => file); // max 512px main
  const thumbFile = await toWebP(file, 128).catch(() => webpFile); // 128 thumb
  const ext = "webp"; // store as webp for consistency
  const path = `${userId}/avatar.${ext}`; // stable filename; we will upsert
  const pathThumb = `${userId}/avatar_128.${ext}`;

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, webpFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp",
  });
  if (upErr) throw new Error(upErr.message ?? "Failed to upload avatar");

  const { error: upErr2 } = await supabase.storage.from("avatars").upload(pathThumb, thumbFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp",
  });
  if (upErr2) throw new Error(upErr2.message ?? "Failed to upload avatar thumbnail");

  const { data, error: signErr } = await supabase
    .storage
    .from("avatars")
    .createSignedUrl(path, 3600);
  if (signErr || !data?.signedUrl) {
    throw new Error(signErr?.message ?? "Failed to sign avatar URL");
  }

  const { data: d2, error: signThumbErr } = await supabase
    .storage
    .from("avatars")
    .createSignedUrl(pathThumb, 3600);
  if (signThumbErr || !d2?.signedUrl) {
    throw new Error(signThumbErr?.message ?? "Failed to sign thumbnail URL");
  }

  const publicUrl = appendVersion(data.signedUrl, Date.now());
  const thumbUrl = appendVersion(d2.signedUrl, Date.now());
  if (!publicUrl || !thumbUrl) throw new Error("Failed to sign avatar URL");

  return { publicUrl, thumbUrl, path, thumbPath: pathThumb };
}

/**
 * Upload a profile header image to the `profile-headers` bucket.
 * - Max 6MB
 * - Accepts png/jpg/jpeg/webp
 */
export async function uploadProfileHeaderImage(
  file: File,
  userId: string,
  profileId: string
): Promise<HeaderUploadResult> {
  if (!file) throw new Error("No file selected");
  if (file.size > 6 * 1024 * 1024) throw new Error("File too large (max 6MB)");

  const type = (file.type || "").toLowerCase();
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!ok.includes(type)) {
    throw new Error("Only PNG, JPG or WEBP images allowed");
  }

  const webpFile = await toWebP(file, 1400).catch(() => file);
  const path = `${userId}/profile-headers/${profileId}.webp`;

  const { error: upErr } = await supabase.storage.from("profile-headers").upload(path, webpFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp",
  });
  if (upErr) throw new Error(upErr.message ?? "Failed to upload header image");

  const { data, error: signErr } = await supabase
    .storage
    .from("profile-headers")
    .createSignedUrl(path, 3600);
  if (signErr || !data?.signedUrl) {
    throw new Error(signErr?.message ?? "Failed to sign header image URL");
  }

  const publicUrl = appendVersion(data.signedUrl, Date.now());
  if (!publicUrl) throw new Error("Failed to sign header image URL");

  return { publicUrl, path };
}

/**
 * Upload a profile logo image to the `profile-logos` bucket.
 * - Max 4MB
 * - Accepts png/jpg/jpeg/webp
 */
export async function uploadProfileLogoImage(
  file: File,
  userId: string,
  profileId: string
): Promise<LogoUploadResult> {
  if (!file) throw new Error("No file selected");
  if (file.size > 4 * 1024 * 1024) throw new Error("File too large (max 4MB)");

  const type = (file.type || "").toLowerCase();
  const ok = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (!ok.includes(type)) {
    throw new Error("Only PNG, JPG or WEBP images allowed");
  }

  const webpFile = await toWebP(file, 600).catch(() => file);
  const path = `${userId}/profile-logos/${profileId}.webp`;

  const { error: upErr } = await supabase.storage.from("profile-logos").upload(path, webpFile, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp",
  });
  if (upErr) throw new Error(upErr.message ?? "Failed to upload logo image");

  const { data, error: signErr } = await supabase
    .storage
    .from("profile-logos")
    .createSignedUrl(path, 3600);
  if (signErr || !data?.signedUrl) {
    throw new Error(signErr?.message ?? "Failed to sign logo image URL");
  }

  const publicUrl = appendVersion(data.signedUrl, Date.now());
  if (!publicUrl) throw new Error("Failed to sign logo image URL");

  return { publicUrl, path };
}

async function toWebP(file: File, maxSize = 512): Promise<File> {
  if ((file.type || "").toLowerCase() === "image/webp") return file;
  const bitmap = await createImageBitmap(file).catch(async () => {
    // Fallback path if createImageBitmap not available
    const dataUrl = await readAsDataURL(file);
    const img = await loadImage(dataUrl);
    return await imageToBitmap(img);
  });
  // scale to fit within maxSize (preserve aspect)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));
  const canvasEl = document.createElement("canvas");
  canvasEl.width = targetW;
  canvasEl.height = targetH;
  const c2 = canvasEl.getContext("2d");
  if (!c2) throw new Error("Canvas unsupported");
  c2.imageSmoothingEnabled = true;
  c2.imageSmoothingQuality = "high";
  c2.drawImage(bitmap, 0, 0, targetW, targetH);
  const blob: Blob = await new Promise((resolve, reject) => {
    canvasEl.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", 0.85);
  });
  return new File([blob], "avatar.webp", { type: "image/webp" });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function imageToBitmap(img: HTMLImageElement): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(img, 0, 0);
  return await createImageBitmap(canvas);
}
