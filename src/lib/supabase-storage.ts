// src/lib/supabase-storage.ts
"use client";

import { supabase } from "@/lib/supabase";

export type UploadResult = { publicUrl: string; thumbUrl: string; path: string; thumbPath: string };

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

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const { data: d2 } = supabase.storage.from("avatars").getPublicUrl(pathThumb);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`; // cache-bust
  const thumbUrl = `${d2.publicUrl}?v=${Date.now()}`;
  if (!publicUrl) throw new Error("Failed to get public URL");

  return { publicUrl, thumbUrl, path, thumbPath: pathThumb };
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
