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
import { uploadProfileLogoImage } from "@/lib/supabase-storage";
import { supabase } from "@/lib/supabase";
import { appendVersion } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  profileId: string;
  logoUrl: string | null;
  onUploaded: (payload: { path: string; version: string; publicUrl: string }) => void;
  variant?: "default" | "compact";
  inputId?: string;
};

const OUTPUT_SIZE = 480;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.01;

export default function ProfileLogoUploader({
  userId,
  profileId,
  logoUrl,
  onUploaded,
  variant = "compact",
  inputId,
}: Props) {
  const isCompact = variant === "compact";
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const previewSize = isCompact
    ? isSmallScreen
      ? 180
      : 220
    : isSmallScreen
      ? 240
      : 300;
  const cropSize = isCompact
    ? isSmallScreen
      ? 120
      : 150
    : isSmallScreen
      ? 160
      : 200;
  const cropHalf = cropSize / 2;
  const cropCorner = Math.round(cropSize * 0.2);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pointerPosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [latestLogoUrl, setLatestLogoUrl] = useState<string | null>(logoUrl ?? null);
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

  useEffect(() => {
    setLatestLogoUrl(logoUrl ?? null);
  }, [logoUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setIsSmallScreen(window.innerWidth < 640);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const resetEditor = useCallback(() => {
    setSourceFile(null);
    setSourceUrl(null);
    setImageMeta(null);
    setPreviewReady(false);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDraggingOver(false);
  }, []);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    const url = URL.createObjectURL(file);
    setSourceFile(file);
    setSourceUrl(url);
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      handleFile(file);
    },
    [handleFile]
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

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDraggingOver(false);
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!previewReady) return;
      setIsDragging(true);
      pointerPosition.current = { x: event.clientX, y: event.clientY };
    },
    [previewReady]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const prev = pointerPosition.current;
      const next = { x: event.clientX, y: event.clientY };
      const delta = { x: next.x - prev.x, y: next.y - prev.y };
      pointerPosition.current = next;
      setOffset((current) => ({
        x: current.x + delta.x,
        y: current.y + delta.y,
      }));
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleZoomChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setZoom(Number(event.target.value));
  }, []);

  const handleCropReady = useCallback(async () => {
    if (!sourceUrl) return;
    try {
      const img = await loadImage(sourceUrl);
      setImageMeta({ width: img.naturalWidth, height: img.naturalHeight });
      setPreviewReady(true);
    } catch {
      setError("Unable to load image.");
    }
  }, [sourceUrl]);

  useEffect(() => {
    if (sourceUrl) {
      void handleCropReady();
    }
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl, handleCropReady]);

  const handleUpload = useCallback(async () => {
    if (!sourceFile || !imageMeta || !sourceUrl) return;
    setError(null);
    setLoading(true);
    try {
      const version = new Date().toISOString();
      const cropped = await cropToWebP(sourceFile, {
        outputSize: OUTPUT_SIZE,
        cropSize,
        baseScale,
        zoom,
        offset,
        srcUrl: sourceUrl,
      });
      const { path, publicUrl } = await uploadProfileLogoImage(
        cropped || sourceFile,
        userId,
        profileId
      );
      const { error: updErr } = await supabase
        .from("user_profiles")
        .update({
          logo_url: path,
          logo_updated_at: version,
          updated_at: version,
        })
        .eq("id", profileId)
        .eq("user_id", userId);
      if (updErr) throw new Error(updErr.message ?? "Failed to save logo");
      const versionedUrl = appendVersion(publicUrl ?? null, version) ?? path;
      setLatestLogoUrl(versionedUrl);
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
    resetEditor();
  }, [sourceUrl, resetEditor]);

  const handleRemove = useCallback(async () => {
    if (loading) return;
    if (!latestLogoUrl && !sourceUrl) return;
    setError(null);
    setLoading(true);
    try {
      const version = new Date().toISOString();
      const { error: updErr } = await supabase
        .from("user_profiles")
        .update({
          logo_url: null,
          logo_updated_at: null,
          updated_at: version,
        })
        .eq("id", profileId)
        .eq("user_id", userId);
      if (updErr) throw new Error(updErr.message ?? "Failed to remove logo");
      setLatestLogoUrl(null);
      resetEditor();
      onUploaded({ path: "", version, publicUrl: "" });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to remove logo";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [loading, latestLogoUrl, sourceUrl, profileId, userId, onUploaded, resetEditor]);

  const helperText = sourceFile
    ? "Drag to reposition the logo inside the crop."
    : "Upload a logo to start cropping.";

  const cardClassName = cn(
    "rounded-2xl border border-dashed border-muted/70 bg-card/80",
    isCompact && "gap-4"
  );

  const previewContainerClassName = cn(
    "relative flex items-center justify-center overflow-hidden border bg-muted/40",
    isCompact ? "rounded-2xl" : "rounded-3xl",
    !sourceUrl && "border-dashed"
  );

  const displayUrl = sourceUrl || latestLogoUrl;
  const inputTargetId = inputId ?? "profile-logo-upload";

  return (
    <Card className={cardClassName}>
      <CardHeader className={cn(isCompact && "px-4 py-4")}>
        <CardTitle className={cn("text-sm font-semibold", isCompact && "text-sm")}>
          Logo badge
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("flex flex-col gap-4 px-4 pb-4", isCompact && "pt-0")}>
        <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center")}>
          <div
            className={previewContainerClassName}
            style={{ width: previewSize, height: previewSize }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {displayUrl ? (
              <div
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={displayUrl}
                  alt=""
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${baseScale * zoom})`,
                    width: imageMeta?.width ?? "auto",
                    height: imageMeta?.height ?? "auto",
                  }}
                  draggable={false}
                />
              </div>
            ) : null}
            <div
              className={cn(
                "pointer-events-none absolute left-1/2 top-1/2 border border-dashed border-border/70",
                isDraggingOver && "border-primary/70"
              )}
              style={{
                width: cropSize,
                height: cropSize,
                marginLeft: -cropHalf,
                marginTop: -cropHalf,
                borderRadius: cropCorner,
              }}
            />
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <Label htmlFor={inputTargetId} className="text-xs text-muted-foreground">
              Upload logo image
            </Label>
            <Input
              id={inputTargetId}
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">{helperText}</p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={handleUpload} disabled={!sourceFile || loading}>
                {loading ? "Uploading..." : "Save logo"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={handleReset} disabled={loading}>
                Reset
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleRemove} disabled={loading}>
                Remove
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Zoom</span>
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={ZOOM_STEP}
                value={zoom}
                onChange={handleZoomChange}
                className="flex-1"
              />
            </div>
          </div>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

async function cropToWebP(
  file: File,
  options: {
    outputSize: number;
    cropSize: number;
    baseScale: number;
    zoom: number;
    offset: { x: number; y: number };
    srcUrl: string | null;
  }
): Promise<File | null> {
  const { outputSize, cropSize, baseScale, zoom, offset, srcUrl } = options;
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
    ctx.rect(0, 0, outputSize, outputSize);
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
    return new File([blob], "profile_logo.webp", { type: "image/webp" });
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
