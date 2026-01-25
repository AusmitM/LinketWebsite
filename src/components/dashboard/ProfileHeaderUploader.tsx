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
import { uploadProfileHeaderImage } from "@/lib/supabase-storage";
import { supabase } from "@/lib/supabase";
import { appendVersion } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  profileId: string;
  headerUrl: string | null;
  onUploaded: (payload: { path: string; version: string; publicUrl: string }) => void;
  variant?: "default" | "compact";
  inputId?: string;
};

const OUTPUT_WIDTH = 1200;
const OUTPUT_HEIGHT = 600;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;

export default function ProfileHeaderUploader({
  userId,
  profileId,
  headerUrl,
  onUploaded,
  variant = "compact",
  inputId,
}: Props) {
  const isCompact = variant === "compact";
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const previewWidth = isCompact
    ? isSmallScreen
      ? 280
      : 340
    : isSmallScreen
      ? 340
      : 420;
  const previewHeight = isCompact
    ? isSmallScreen
      ? 170
      : 210
    : isSmallScreen
      ? 210
      : 260;
  const cropWidth = isCompact
    ? isSmallScreen
      ? 250
      : 300
    : isSmallScreen
      ? 300
      : 360;
  const cropHeight = isCompact
    ? isSmallScreen
      ? 120
      : 150
    : isSmallScreen
      ? 150
      : 180;
  const cropHalfWidth = cropWidth / 2;
  const cropHalfHeight = cropHeight / 2;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [latestHeaderUrl, setLatestHeaderUrl] = useState<string | null>(headerUrl ?? null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setDraggingOver] = useState(false);

  const baseScale = useMemo(() => {
    if (!imageMeta) return 1;
    return Math.max(cropWidth / imageMeta.width, cropHeight / imageMeta.height);
  }, [imageMeta, cropWidth, cropHeight]);

  const previewScale = baseScale * zoom;

  const clampOffset = useCallback(
    (next: { x: number; y: number }, nextZoom = zoom, meta = imageMeta): { x: number; y: number } => {
      if (!meta) return next;
      const scale = baseScale * nextZoom;
      const halfWidth = (meta.width * scale) / 2;
      const halfHeight = (meta.height * scale) / 2;
      const limitX = Math.max(0, halfWidth - cropHalfWidth);
      const limitY = Math.max(0, halfHeight - cropHalfHeight);
      return {
        x: Math.max(-limitX, Math.min(limitX, next.x)),
        y: Math.max(-limitY, Math.min(limitY, next.y)),
      };
    },
    [baseScale, zoom, imageMeta, cropHalfWidth, cropHalfHeight]
  );

  const resetEditor = useCallback(() => {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setSourceFile(null);
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
    if (!latestHeaderUrl || loading) return;
    setError(null);
    try {
      const response = await fetch(latestHeaderUrl);
      if (!response.ok) throw new Error("Unable to load header image");
      const blob = await response.blob();
      handleFile(
        new File([blob], "profile_header.webp", {
          type: blob.type || "image/webp",
        })
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load header image";
      setError(message);
    }
  }, [latestHeaderUrl, loading, handleFile]);

  useEffect(() => {
    if (headerUrl !== latestHeaderUrl) {
      setLatestHeaderUrl(headerUrl ?? null);
    }
  }, [headerUrl, latestHeaderUrl]);

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
        outputWidth: OUTPUT_WIDTH,
        outputHeight: OUTPUT_HEIGHT,
        cropWidth,
        cropHeight,
        baseScale,
        zoom,
        offset,
        srcUrl: sourceUrl,
      });
      const { path, publicUrl } = await uploadProfileHeaderImage(
        cropped || sourceFile,
        userId,
        profileId
      );
      const { error: updErr } = await supabase
        .from("user_profiles")
        .update({
          header_image_url: path,
          header_image_updated_at: version,
          updated_at: version,
        })
        .eq("id", profileId)
        .eq("user_id", userId);
      if (updErr) throw new Error(updErr.message ?? "Failed to save header image");
      const versionedUrl = appendVersion(publicUrl ?? null, version) ?? path;
      setLatestHeaderUrl(versionedUrl);
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
    cropWidth,
    cropHeight,
    baseScale,
    zoom,
    offset,
    userId,
    profileId,
    onUploaded,
    resetEditor,
  ]);

  const handleReset = useCallback(() => {
    if (sourceUrl) {
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
      return;
    }
    if (latestHeaderUrl) {
      void handleReCrop();
    }
  }, [sourceUrl, latestHeaderUrl, handleReCrop]);

  const handleRemove = useCallback(async () => {
    if (loading) return;
    if (!latestHeaderUrl && !sourceUrl) return;
    setError(null);
    setLoading(true);
    try {
      const version = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("user_profiles")
        .update({
          header_image_url: null,
          header_image_updated_at: null,
          updated_at: version,
        })
        .eq("id", profileId)
        .eq("user_id", userId);
      if (updErr) throw new Error(updErr.message ?? "Failed to remove header image");
      setLatestHeaderUrl(null);
      resetEditor();
      onUploaded({ path: "", version, publicUrl: "" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to remove header image";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [loading, latestHeaderUrl, sourceUrl, profileId, userId, onUploaded, resetEditor]);

  const helperText = sourceFile
    ? "Drag to reposition the image inside the crop."
    : "Upload a photo to start cropping.";

  const previewContainerClassName = cn(
    "relative flex items-center justify-center overflow-hidden border bg-muted/40",
    isCompact
      ? "max-w-[300px] rounded-2xl sm:max-w-[360px]"
      : "max-w-[360px] rounded-3xl sm:max-w-[440px]",
    !sourceUrl && "border-dashed"
  );

  if (variant === "compact") {
    const displayUrl = sourceUrl || latestHeaderUrl;
    const inputTargetId = inputId ?? "profile-header-upload";
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-dashed border-muted/70 p-4">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
          <div className="h-16 w-28 overflow-hidden rounded-xl border bg-muted sm:h-20 sm:w-36">
            {displayUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayUrl} alt="Header image" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                300A-150
              </div>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor={inputTargetId}>Header image</Label>
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
              ) : latestHeaderUrl ? (
                <span>Current header</span>
              ) : (
                <span>Crop to fit the header. JPG/PNG/WebP.</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={handleReCrop}
                disabled={!latestHeaderUrl || loading}
              >
                Re-crop
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={handleRemove}
                disabled={!(latestHeaderUrl || sourceUrl) || loading}
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
              style={{ width: "100%", maxWidth: `${previewWidth}px`, height: `${previewHeight}px` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              role="application"
              aria-label="Header crop preview"
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
                <svg className="h-full w-full" viewBox={`0 0 ${previewWidth} ${previewHeight}`}>
                  <rect width={previewWidth} height={previewHeight} fill="transparent" />
                  <rect
                    x={(previewWidth - cropWidth) / 2}
                    y={(previewHeight - cropHeight) / 2}
                    width={cropWidth}
                    height={cropHeight}
                    rx={16}
                    ry={16}
                    fill="none"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="header-zoom"
                className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground"
              >
                Zoom
                <span className="text-[11px] font-semibold text-foreground">
                  {Math.round(zoom * 100)}%
                </span>
              </label>
              <input
                id="header-zoom"
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
                disabled={!(sourceUrl || latestHeaderUrl) || loading}
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
    <Card className={cn("rounded-2xl border border-border/70 bg-card/80 shadow-sm", isCompact && "gap-4 py-4")}>
      <CardHeader className={cn(isCompact && "px-4")}>
        <CardTitle className={cn(isCompact && "text-sm")}>
          Header background (mobile)
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-6 lg:flex-row lg:items-start", isCompact && "gap-4 px-4")}>
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
                style={{ width: previewWidth, height: previewHeight }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                role="application"
                aria-label="Header crop preview"
              >
                {!previewReady && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground">
                    Loading preview...
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
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
                    viewBox={`0 0 ${previewWidth} ${previewHeight}`}
                  >
                    <rect
                      width={previewWidth}
                      height={previewHeight}
                      fill="transparent"
                    />
                    <rect
                      x={(previewWidth - cropWidth) / 2}
                      y={(previewHeight - cropHeight) / 2}
                      width={cropWidth}
                      height={cropHeight}
                      fill="none"
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              </div>
            ) : latestHeaderUrl ? (
              <button
                type="button"
                className="relative h-full w-full"
                onClick={handleReCrop}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={latestHeaderUrl}
                  alt="Current header background"
                  className="h-full w-full rounded-2xl object-cover"
                />
                <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                  Change image
                </span>
              </button>
            ) : (
              <button
                type="button"
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-3 text-center transition",
                  isCompact ? "rounded-2xl p-6" : "rounded-3xl p-10",
                  isDraggingOver ? "bg-accent/30" : "bg-transparent"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div
                  className={cn(
                    "flex items-center justify-center rounded-2xl border-2 border-dashed border-border text-muted-foreground",
                    isCompact ? "h-14 w-14 text-xs" : "h-20 w-20 text-sm"
                  )}
                >
                  Upload
                </div>
                <div className="space-y-1 text-[11px]">
                  <p className="text-xs font-semibold text-foreground">
                    Upload header background
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, or WebP up to 6MB
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
                PNG/JPG/WebP  Up to 6MB  Saved as WebP
              </span>
            </div>

            {sourceUrl && (
              <div className="space-y-2">
                <label
                  htmlFor="header-zoom"
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
                  id="header-zoom"
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
                disabled={!(sourceUrl || latestHeaderUrl)}
              >
                Reset
              </button>
              <button
                type="button"
                className="text-destructive hover:text-destructive/80"
                onClick={handleRemove}
                disabled={!(sourceUrl || latestHeaderUrl)}
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
    outputWidth: number;
    outputHeight: number;
    cropWidth: number;
    cropHeight: number;
    baseScale: number;
    zoom: number;
    offset: { x: number; y: number };
    srcUrl: string | null;
  }
): Promise<File | null> {
  const { outputWidth, outputHeight, cropWidth, cropHeight, baseScale, zoom, offset, srcUrl } =
    options;
  try {
    const img = await loadImage(srcUrl || URL.createObjectURL(file));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, outputWidth, outputHeight);

    const ratioX = outputWidth / cropWidth;
    const ratioY = outputHeight / cropHeight;
    const combinedScale = baseScale * zoom * Math.min(ratioX, ratioY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, outputWidth, outputHeight);
    ctx.closePath();
    ctx.clip();

    ctx.translate(outputWidth / 2 + offset.x * ratioX, outputHeight / 2 + offset.y * ratioY);
    ctx.scale(combinedScale, combinedScale);
    ctx.translate(-img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.drawImage(img, 0, 0);
    ctx.restore();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/webp", 0.9)
    );
    if (!blob) return null;
    return new File([blob], "profile_header.webp", { type: "image/webp" });
  } catch (error) {
    console.error("cropToWebP failed", error);
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
