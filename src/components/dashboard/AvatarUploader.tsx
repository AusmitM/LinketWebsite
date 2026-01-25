"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { uploadAvatar } from "@/lib/supabase-storage";
import { supabase } from "@/lib/supabase";
import { appendVersion } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  userEmail?: string | null;
  avatarUrl: string | null;
  onUploaded: (payload: { path: string; version: string; publicUrl: string }) => void;
  variant?: "default" | "compact";
  inputId?: string;
};

const OUTPUT_SIZE = 640;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;

export default function AvatarUploader({
  userId,
  userEmail = null,
  avatarUrl,
  onUploaded,
  variant = "default",
  inputId,
}: Props) {
  const isCompact = variant === "compact";
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const previewSize = isCompact
    ? isSmallScreen
      ? 200
      : 240
    : isSmallScreen
      ? 280
      : 340;
  const cropSize = isCompact
    ? isSmallScreen
      ? 150
      : 180
    : isSmallScreen
      ? 210
      : 260;
  const cropHalf = cropSize / 2;
  const cropCorner = Math.round(cropSize * 0.22);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [latestAvatarUrl, setLatestAvatarUrl] = useState<string | null>(avatarUrl ?? null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setDraggingOver] = useState(false);

  const baseScale = useMemo(() => {
    if (!imageMeta) return 1;
    return Math.max(cropSize / imageMeta.width, cropSize / imageMeta.height);
  }, [imageMeta, cropSize]);

  const previewScale = baseScale * zoom;

  const clampOffset = useCallback(
    (next: { x: number; y: number }, nextZoom = zoom, meta = imageMeta): { x: number; y: number } => {
      if (!meta) return next;
      const scale = baseScale * nextZoom;
      const halfWidth = (meta.width * scale) / 2;
      const halfHeight = (meta.height * scale) / 2;
      const limitX = Math.max(0, halfWidth - cropHalf);
      const limitY = Math.max(0, halfHeight - cropHalf);
      return {
        x: Math.max(-limitX, Math.min(limitX, next.x)),
        y: Math.max(-limitY, Math.min(limitY, next.y)),
      };
    },
    [baseScale, zoom, imageMeta, cropHalf]
  );

  const resetEditor = useCallback(() => {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    setSourceUrl(null);
    setImageMeta(null);
    setPreviewReady(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError(null);
  }, [sourceUrl]);

  const handleFile = useCallback(
    (file: File | null) => {
      resetEditor();
      if (!file) return;
      setSourceFile(file);
      setSourceUrl(URL.createObjectURL(file));
    },
    [resetEditor]
  );

  const handleReCrop = useCallback(async () => {
    if (!latestAvatarUrl || loading) return;
    setError(null);
    try {
      const response = await fetch(latestAvatarUrl);
      if (!response.ok) throw new Error("Unable to load avatar");
      const blob = await response.blob();
      handleFile(
        new File([blob], "avatar.webp", {
          type: blob.type || "image/webp",
        })
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load avatar";
      setError(message);
    }
  }, [latestAvatarUrl, loading, handleFile]);

  useEffect(() => {
    if (avatarUrl !== latestAvatarUrl) {
      setLatestAvatarUrl(avatarUrl ?? null);
    }
  }, [avatarUrl, latestAvatarUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 640px)");
    const update = () => setIsSmallScreen(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (!sourceUrl) return;
    setPreviewReady(false);
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
      setPreviewReady(true);
      setOffset({ x: 0, y: 0 });
      setZoom(1);
    };
    img.onerror = () => {
      if (cancelled) return;
      setError("Could not load preview. Try a different image.");
      resetEditor();
    };
    img.src = sourceUrl;
    return () => {
      cancelled = true;
    };
  }, [sourceUrl, resetEditor]);

  useEffect(() => {
    setOffset((current) => clampOffset(current));
  }, [zoom, clampOffset]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewReady || event.button !== 0) return;
    setIsDragging(true);
    pointerPosition.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [previewReady]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      event.preventDefault();
      const deltaX = event.clientX - pointerPosition.current.x;
      const deltaY = event.clientY - pointerPosition.current.y;
      pointerPosition.current = { x: event.clientX, y: event.clientY };
      setOffset((prev) => clampOffset({ x: prev.x + deltaX, y: prev.y + deltaY }));
    },
    [isDragging, clampOffset]
  );

  const handlePointerUp = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDraggingOver(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      handleFile(file);
    },
    [handleFile]
  );

  const resolveUsername = useCallback(async () => {
    const direct = userEmail?.trim();
    if (direct) return direct.toLowerCase();
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email?.trim();
    return email ? email.toLowerCase() : null;
  }, [userEmail]);

  const handleUpload = useCallback(async () => {
    if (!sourceFile || !sourceUrl || !imageMeta) {
      setError("Choose and position a photo before saving.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const version = new Date().toISOString();
      const cropped = await cropToWebP(sourceFile, {
        outputSize: OUTPUT_SIZE,
        cropSize,
        cornerRadius: cropCorner,
        baseScale,
        zoom,
        offset,
        srcUrl: sourceUrl,
      });
      const { path, publicUrl } = await uploadAvatar(cropped || sourceFile, userId);
      const username = await resolveUsername();
      if (!username) {
        throw new Error("Unable to confirm account email");
      }
      const { error: updErr } = await supabase
        .from("profiles")
        .upsert(
          { user_id: userId, username, avatar_url: path, updated_at: version },
          { onConflict: "user_id" }
        );
      if (updErr) throw new Error(updErr.message ?? "Failed to save avatar");
      const versionedUrl = appendVersion(publicUrl ?? null, version) ?? path;
      setLatestAvatarUrl(versionedUrl);
      onUploaded({ path, version, publicUrl: versionedUrl });
      resetEditor();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err && typeof (err as { message?: unknown }).message === "string"
          ? String((err as { message?: unknown }).message)
          : "Upload failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    sourceFile,
    sourceUrl,
    imageMeta,
    cropSize,
    cropCorner,
    baseScale,
    zoom,
    offset,
    userId,
    onUploaded,
    resetEditor,
    resolveUsername,
  ]);

  const handleReset = useCallback(() => {
    if (sourceUrl) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
      return;
    }
    if (latestAvatarUrl) {
      void handleReCrop();
    }
  }, [sourceUrl, latestAvatarUrl, handleReCrop]);

  const handleRemove = useCallback(async () => {
    if (loading) return;
    if (!latestAvatarUrl && !sourceUrl) return;
    setError(null);
    setLoading(true);
    try {
      const version = new Date().toISOString();
      const username = await resolveUsername();
      if (!username) {
        throw new Error("Unable to confirm account email");
      }
      const { error: updErr } = await supabase
        .from("profiles")
        .upsert(
          { user_id: userId, username, avatar_url: null, updated_at: version },
          { onConflict: "user_id" }
        );
      if (updErr) throw new Error(updErr.message ?? "Failed to remove avatar");
      setLatestAvatarUrl(null);
      resetEditor();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSourceFile(null);
      onUploaded({ path: "", version, publicUrl: "" });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to remove avatar";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [
    loading,
    latestAvatarUrl,
    sourceUrl,
    userId,
    onUploaded,
    resetEditor,
    resolveUsername,
  ]);

  const helperText = sourceFile
    ? "Drag to reposition the image inside the crop."
    : "Upload a photo to start cropping.";

  const cardClassName = cn(
    "rounded-2xl border border-border/70 bg-card/80 shadow-sm",
    isCompact && "gap-4 py-4"
  );
  const headerClassName = cn(isCompact && "px-4");
  const titleClassName = cn(isCompact && "text-sm");
  const descriptionClassName = cn(
    "text-sm text-muted-foreground",
    isCompact && "text-xs"
  );
  const contentClassName = cn(
    "flex flex-col gap-6 lg:flex-row lg:items-start",
    isCompact && "gap-4 px-4"
  );
  const previewContainerClassName = cn(
    "relative flex aspect-square items-center justify-center overflow-hidden border bg-muted/40",
    isCompact
      ? "max-w-[260px] rounded-2xl sm:max-w-[320px]"
      : "max-w-[320px] rounded-3xl sm:max-w-[420px]",
    !sourceUrl && "border-dashed"
  );
  const dropButtonClassName = cn(
    "flex h-full w-full flex-col items-center justify-center gap-3 text-center transition",
    isCompact ? "rounded-2xl p-6" : "rounded-3xl p-10",
    isDraggingOver ? "bg-accent/30" : "bg-transparent"
  );
  const dropCircleClassName = cn(
    "flex items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground",
    isCompact ? "h-14 w-14 text-xs" : "h-20 w-20 text-sm"
  );

  if (variant === "compact") {
    const displayUrl = sourceUrl || latestAvatarUrl;
    const inputTargetId = inputId ?? "profile-avatar-upload";
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-muted/70 p-4">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-16 w-16 overflow-hidden rounded-full border bg-muted sm:h-20 sm:w-20">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayUrl} alt="Profile photo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                150A-150
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor={inputTargetId}>Profile photo</Label>
            <Input
              ref={fileInputRef}
              id={inputTargetId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
              disabled={loading}
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {sourceFile?.name ? (
                <span className="truncate">Selected: {sourceFile.name}</span>
              ) : latestAvatarUrl ? (
                <span>Current photo</span>
              ) : (
                <span>Crop to fit the circle. JPG/PNG/WebP.</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full bg-primary text-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:bg-primary/70 disabled:text-foreground/90 disabled:opacity-100"
                onClick={handleReCrop}
                disabled={!latestAvatarUrl || loading}
              >
                Re-crop
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full bg-primary text-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:bg-primary/70 disabled:text-foreground/90 disabled:opacity-100"
                onClick={handleRemove}
                disabled={!(latestAvatarUrl || sourceUrl) || loading}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>

        {sourceUrl && (
          <div className="space-y-3">
            <div
              className="relative flex items-center justify-center overflow-hidden rounded-2xl border bg-muted/40 cursor-grab touch-none active:cursor-grabbing"
              style={{ width: "100%", maxWidth: `${previewSize}px`, height: `${previewSize}px` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              role="application"
              aria-label="Avatar crop preview"
            >
              {!previewReady && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground">
                  Loading preview...
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sourceUrl}
                  alt="Crop preview"
                  className="absolute left-1/2 top-1/2 block select-none opacity-90"
                  style={{
                    width: imageMeta?.width ?? "auto",
                    height: imageMeta?.height ?? "auto",
                    maxWidth: "none",
                    maxHeight: "none",
                    transform: `translate(-50%, -50%) scale(${previewScale})`,
                    transformOrigin: "center",
                    zIndex: 1,
                  }}
                  draggable={false}
                />
              </div>
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <svg className="h-full w-full" viewBox={`0 0 ${previewSize} ${previewSize}`}>
                  <rect width={previewSize} height={previewSize} fill="transparent" />
                  <rect
                    x={(previewSize - cropSize) / 2}
                    y={(previewSize - cropSize) / 2}
                    width={cropSize}
                    height={cropSize}
                    rx={cropCorner}
                    ry={cropCorner}
                    fill="none"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="avatar-zoom"
                className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground"
              >
                Zoom
                <span className="text-[11px] font-semibold text-foreground">
                  {Math.round(zoom * 100)}%
                </span>
              </label>
              <input
                id="avatar-zoom"
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="dashboard-zoom-slider w-full"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={!previewReady || loading}
                onClick={handleUpload}
              >
                {loading ? "Saving..." : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={handleReset}
                disabled={!(sourceUrl || latestAvatarUrl) || loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    );
  }

  return (
    <Card className={cardClassName}>
      <CardHeader className={headerClassName}>
        <CardTitle className={titleClassName}>Avatar</CardTitle>
      </CardHeader>
      <CardContent className={contentClassName}>
        <section className="flex-1 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            id={inputId}
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <div
            className={previewContainerClassName}
            onDragOver={(event) => {
              event.preventDefault();
              setDraggingOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDraggingOver(false);
            }}
            onDrop={handleDrop}
          >
            {sourceUrl ? (
              <div
                className="relative cursor-grab touch-none active:cursor-grabbing"
                style={{ width: previewSize, height: previewSize }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                role="application"
                aria-label="Avatar crop preview"
              >
                {!previewReady && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground">
                    Loading preview...
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourceUrl}
                    alt="Crop preview"
                    className="absolute left-1/2 top-1/2 block select-none opacity-90"
                    style={{
                      width: imageMeta?.width ?? "auto",
                      height: imageMeta?.height ?? "auto",
                      maxWidth: "none",
                      maxHeight: "none",
                      transform: `translate(-50%, -50%) scale(${previewScale})`,
                      transformOrigin: "center",
                      zIndex: 1,
                    }}
                    draggable={false}
                  />
                </div>
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  <svg
                    className="h-full w-full"
                    viewBox={`0 0 ${previewSize} ${previewSize}`}
                  >
                    <rect
                      width={previewSize}
                      height={previewSize}
                      fill="transparent"
                    />
                    <rect
                      x={(previewSize - cropSize) / 2}
                      y={(previewSize - cropSize) / 2}
                      width={cropSize}
                      height={cropSize}
                      rx={cropCorner}
                      ry={cropCorner}
                      fill="none"
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
            ) : latestAvatarUrl ? (
              <button
                type="button"
                className="relative h-full w-full"
                onClick={handleReCrop}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={latestAvatarUrl}
                  alt="Current avatar"
                  className="h-full w-full rounded-3xl object-cover"
                />
                <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                  Change photo
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={dropButtonClassName}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={dropCircleClassName}>Upload</div>
                <div className="space-y-1 text-[11px]">
                  <p className="text-xs font-semibold text-foreground">
                    Upload profile photo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, or WebP up to 5MB
                  </p>
                </div>
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{helperText}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </section>

        <aside className={cn("w-full max-w-sm", isCompact && "max-w-[280px]")}>
          <div className={cn("space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm", isCompact && "space-y-3 p-3")}>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size={isCompact ? "sm" : "default"}
                className="rounded-full"
                disabled={!sourceUrl || !previewReady || loading}
                onClick={handleUpload}
              >
                {loading ? "Saving..." : "Save"}
              </Button>
              <span className={cn("text-xs text-muted-foreground", isCompact && "text-[11px]")}>
                PNG/JPG/WebP  Up to 5MB  Saved as WebP
              </span>
            </div>

            {sourceUrl && (
              <div className="space-y-2">
                <label
                  htmlFor="avatar-zoom"
                  className={cn(
                    "flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground",
                    isCompact && "text-[10px]"
                  )}
                >
                  Zoom
                  <span className="text-[11px] font-semibold text-foreground">
                    {Math.round(zoom * 100)}%
                  </span>
                </label>
                <input
                  id="avatar-zoom"
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={ZOOM_STEP}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="dashboard-zoom-slider w-full"
                />
              </div>
            )}

            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={handleReset}
                disabled={!(sourceUrl || latestAvatarUrl)}
              >
                Reset
              </button>
              <button
                type="button"
                className="text-destructive hover:text-destructive/80"
                onClick={handleRemove}
                disabled={!(sourceUrl || latestAvatarUrl)}
              >
                Remove
              </button>
            </div>
          </div>
        </aside>
      </CardContent>
    </Card>
  );
}

async function cropToWebP(
  file: File,
  options: {
    outputSize: number;
    cropSize: number;
    cornerRadius: number;
    baseScale: number;
    zoom: number;
    offset: { x: number; y: number };
    srcUrl: string | null;
  }
): Promise<File | null> {
  const { outputSize, cropSize, cornerRadius, baseScale, zoom, offset, srcUrl } =
    options;
  try {
    const img = await loadImage(srcUrl || URL.createObjectURL(file));
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, outputSize, outputSize);

    const ratio = outputSize / cropSize;
    const combinedScale = baseScale * zoom * ratio;

    ctx.save();
    ctx.beginPath();
    roundedRect(
      ctx,
      (outputSize - cropSize * ratio) / 2,
      (outputSize - cropSize * ratio) / 2,
      cropSize * ratio,
      cropSize * ratio,
      cornerRadius * ratio
    );
    ctx.closePath();
    ctx.clip();

    ctx.translate(outputSize / 2 + offset.x * ratio, outputSize / 2 + offset.y * ratio);
    ctx.scale(combinedScale, combinedScale);
    ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/webp", 0.9)
    );
    if (!blob) return null;
    return new File([blob], "avatar_cropped.webp", { type: "image/webp" });
  } catch (error) {
    console.error("cropToWebP failed", error);
    return null;
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}



