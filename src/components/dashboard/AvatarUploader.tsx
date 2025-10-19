"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { uploadAvatar } from "@/lib/supabase-storage";
import { supabase } from "@/lib/supabase";
import { buildAvatarPublicUrl } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  avatarUrl: string | null;
  onUploaded: (payload: { path: string; version: string; publicUrl: string }) => void;
};

type InteractionMode = "idle" | "pan";

const OUTPUT_SIZE = 640;
const PREVIEW_SIZE = 340;
const CROP_DIAMETER = 260;
const CROP_RADIUS = CROP_DIAMETER / 2;
const MINI_PREVIEW_DIAMETER = 96;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;

export default function AvatarUploader({ userId, avatarUrl, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerMode = useRef<InteractionMode>("idle");
  const pointerPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [zoom, setZoom] = useState(1.2);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setDraggingOver] = useState(false);

  const baseScale = useMemo(() => {
    if (!imageMeta) return 1;
    return Math.max(CROP_DIAMETER / imageMeta.width, CROP_DIAMETER / imageMeta.height);
  }, [imageMeta]);

  const previewScale = baseScale * zoom;
  const miniScale = previewScale * (MINI_PREVIEW_DIAMETER / CROP_DIAMETER);

  const clampOffset = useCallback(
    (next: { x: number; y: number }, nextZoom = zoom, meta = imageMeta): { x: number; y: number } => {
      if (!meta) return next;
      const scale = baseScale * nextZoom;
      const halfWidth = (meta.width * scale) / 2;
      const halfHeight = (meta.height * scale) / 2;
      const limitX = Math.max(0, halfWidth - CROP_RADIUS);
      const limitY = Math.max(0, halfHeight - CROP_RADIUS);
      return {
        x: Math.max(-limitX, Math.min(limitX, next.x)),
        y: Math.max(-limitY, Math.min(limitY, next.y)),
      };
    },
    [baseScale, zoom, imageMeta]
  );

  const resetCropState = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setImageMeta(null);
    setPreviewReady(false);
    setZoom(1.2);
    setOffset({ x: 0, y: 0 });
    setError(null);
  }, [previewUrl]);

  const handleFile = useCallback(
    (file: File | null) => {
      resetCropState();
      setSelectedFile(file);
      if (!file) {
        setFileName("");
        return;
      }
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    },
    [resetCropState]
  );

  useEffect(() => {
    if (!previewUrl) return;
    setPreviewReady(false);
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
      setPreviewReady(true);
      setOffset({ x: 0, y: 0 });
      setZoom(1.2);
    };
    img.onerror = () => {
      if (cancelled) return;
      setError("Could not load preview. Try a different image.");
      resetCropState();
    };
    img.src = previewUrl;
    return () => {
      cancelled = true;
    };
  }, [previewUrl, resetCropState]);

  useEffect(() => {
    setOffset((current) => clampOffset(current));
  }, [zoom, clampOffset]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!previewReady || event.button !== 0) return;
    pointerMode.current = "pan";
    pointerPosition.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [previewReady]);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (pointerMode.current !== "pan") return;
      event.preventDefault();
      const deltaX = event.clientX - pointerPosition.current.x;
      const deltaY = event.clientY - pointerPosition.current.y;
      pointerPosition.current = { x: event.clientX, y: event.clientY };
      setOffset((prev) => clampOffset({ x: prev.x + deltaX, y: prev.y + deltaY }));
    },
    [clampOffset]
  );

  const handlePointerUp = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerMode.current = "idle";
  }, []);

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      if (!previewReady) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : -1;
      setZoom((current) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + direction * 0.08));
        return Number(next.toFixed(3));
      });
    },
    [previewReady]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDraggingOver(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      handleFile(file);
    },
    [handleFile]
  );

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !previewUrl || !imageMeta) {
      setError("Choose and position a photo before uploading.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const version = new Date().toISOString();
      const cropped = await cropToWebP(selectedFile, {
        outputSize: OUTPUT_SIZE,
        circleDiameter: CROP_DIAMETER,
        baseScale,
        zoom,
        offset,
        srcUrl: previewUrl,
      });
      const { path, publicUrl } = await uploadAvatar(cropped || selectedFile, userId);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: version })
        .eq("user_id", userId);
      if (updErr) throw new Error(updErr.message ?? "Failed to save avatar");
      const versionedUrl = buildAvatarPublicUrl(path, version) ?? publicUrl ?? path;
      onUploaded({ path, version, publicUrl: versionedUrl });
      resetCropState();
      setSelectedFile(null);
      setFileName("");
    } catch (err) {
      console.error("avatar upload failed", err);
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
  }, [selectedFile, previewUrl, imageMeta, baseScale, zoom, offset, userId, onUploaded, resetCropState]);

  const currentAvatarThumb = previewUrl && previewReady ? previewUrl : avatarUrl;
  const zoomPercent = Math.round(zoom * 100);
  const helperText = selectedFile
    ? "Click and drag to reposition. Use the slider or scroll wheel to zoom."
    : "Drop a photo here or choose a file to get started.";

  return (
    <Card className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a square or portrait photo. We’ll convert it to WebP, crop it to a perfect circle, and replace your profile image everywhere.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <section className="flex-1 space-y-4">
          <div
            className={cn(
              "relative flex aspect-square max-w-[420px] items-center justify-center overflow-hidden rounded-3xl border bg-muted/40",
              !previewUrl && "border-dashed"
            )}
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
            {previewUrl ? (
              <div
                className="relative"
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onWheel={handleWheel}
                role="application"
                aria-label="Avatar crop preview"
              >
                {!previewReady && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-muted/60 text-sm text-muted-foreground">
                    Loading preview…
                  </div>
                )}
                <div
                  className="absolute inset-[12px] rounded-xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)0%,rgba(15,23,42,0.1)100%)]"
                  aria-hidden
                />
                {previewUrl && (
                  <div
                    className={cn(
                      "pointer-events-none select-none transition-opacity duration-300 absolute left-1/2 top-1/2",
                      previewReady ? "opacity-100" : "opacity-0"
                    )}
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px)`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Crop preview"
                      className="absolute left-1/2 top-1/2 block select-none"
                      style={{
                        width: imageMeta?.width ?? "auto",
                        height: imageMeta?.height ?? "auto",
                        transform: `translate(-50%, -50%) scale(${previewScale})`,
                        transformOrigin: "center",
                      }}
                      draggable={false}
                    />
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-[12px]"
                  aria-hidden
                  style={{
                    background: `radial-gradient(circle ${CROP_RADIUS}px at center, rgba(15,23,42,0) 0%, rgba(15,23,42,0) ${CROP_RADIUS - 3}px, rgba(15,23,42,0.55) ${CROP_RADIUS}px, rgba(15,23,42,0.75) 100%)`,
                  }}
                />
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.45)]"
                  style={{ width: CROP_DIAMETER, height: CROP_DIAMETER }}
                />
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  "flex h-full w-full flex-col items-center justify-center gap-3 rounded-3xl p-10 text-center transition",
                  isDraggingOver ? "bg-accent/30" : "bg-transparent"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border text-sm text-muted-foreground">
                  Drop photo
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Drag &amp; drop a file</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, or WebP up to 5MB</p>
                  <p className="text-xs text-primary underline">or click to browse</p>
                </div>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-muted/40">
              {currentAvatarThumb ? (
                <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full border border-white/70 shadow-inner">
                  {previewUrl && previewReady && (
                    <div
                      className="absolute left-1/2 top-1/2 h-full w-full"
                      style={{
                        transform: `translate(${offset.x * (MINI_PREVIEW_DIAMETER / CROP_DIAMETER)}px, ${
                          offset.y * (MINI_PREVIEW_DIAMETER / CROP_DIAMETER)
                        }px)`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Cropped avatar preview"
                        className="absolute left-1/2 top-1/2 select-none"
                        style={{
                          width: imageMeta?.width ?? "auto",
                          height: imageMeta?.height ?? "auto",
                          transform: `translate(-50%, -50%) scale(${miniScale})`,
                          transformOrigin: "center",
                        }}
                        draggable={false}
                      />
                    </div>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentAvatarThumb}
                    alt="Live avatar preview"
                    className={cn(
                      previewUrl && previewReady ? "opacity-0" : "opacity-100",
                      "absolute h-full w-full object-cover transition-opacity duration-300"
                    )}
                    style={{ left: 0, top: 0, position: "absolute" }}
                  />
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">No avatar</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{helperText}</p>
          </div>
        </section>

        <aside className="w-full max-w-sm space-y-5">
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-4 shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" className="rounded-full" onClick={() => fileInputRef.current?.click()}>
                  Choose photo
                </Button>
                {fileName && <span className="truncate text-xs text-muted-foreground">{fileName}</span>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>PNG/JPG/WebP</span>
                <span aria-hidden>•</span>
                <span>Up to 5MB</span>
                <span aria-hidden>•</span>
                <span>We store as WebP</span>
              </div>
            </div>
          </div>

          {previewUrl && previewReady && (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-card/60 p-4 shadow-sm">
              <div className="space-y-2">
                <label htmlFor="avatar-zoom" className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Zoom
                  <span className="text-[11px] font-semibold text-foreground">{zoomPercent}%</span>
                </label>
                <input
                  id="avatar-zoom"
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={ZOOM_STEP}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setZoom(1.2);
                    setOffset({ x: 0, y: 0 });
                  }}
                >
                  Reset view
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-destructive"
                  onClick={() => {
                    handleFile(null);
                    setSelectedFile(null);
                    setFileName("");
                  }}
                >
                  Remove photo
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="rounded-full px-6"
              disabled={!previewUrl || !previewReady || loading}
              onClick={handleUpload}
            >
              {loading ? "Uploading…" : "Save avatar"}
            </Button>
            <p className="text-xs text-muted-foreground">Your new avatar replaces the old one everywhere instantly.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </aside>
      </CardContent>
    </Card>
  );
}

async function cropToWebP(
  file: File,
  options: {
    outputSize: number;
    circleDiameter: number;
    baseScale: number;
    zoom: number;
    offset: { x: number; y: number };
    srcUrl: string | null;
  }
): Promise<File | null> {
  const { outputSize, circleDiameter, baseScale, zoom, offset, srcUrl } = options;
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

    const ratio = outputSize / circleDiameter;
    const combinedScale = baseScale * zoom * ratio;
    const translationDivisor = baseScale * zoom === 0 ? 1 : baseScale * zoom;

    ctx.save();
    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, (circleDiameter / 2) * ratio, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.translate((offset.x * ratio) / translationDivisor, (offset.y * ratio) / translationDivisor);
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
