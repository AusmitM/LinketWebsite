"use client";

import { useMemo, useState } from "react";
import Image, { type ImageProps } from "next/image";
import { cn } from "@/lib/utils";

type FallbackKind = "avatar" | "header" | "logo" | "generic";

type Props = Omit<ImageProps, "alt"> & {
  alt: string;
  fallbackKind?: FallbackKind;
  fallbackLabel?: string | null;
};

function toMonogram(value: string | null | undefined, maxChars: number) {
  if (!value) return "L";
  const cleaned = value.trim();
  if (!cleaned) return "L";
  const words = cleaned
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "L";
  if (words.length === 1) return words[0].slice(0, maxChars).toUpperCase();
  return words
    .slice(0, maxChars)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function PublicProfileImage({
  className,
  onLoad,
  onError,
  src,
  alt,
  fallbackKind = "generic",
  fallbackLabel = null,
  ...props
}: Props) {
  const [loadState, setLoadState] = useState<"pending" | "ready" | "error">(
    "pending"
  );
  const isReady = loadState === "ready";

  const fallbackText = useMemo(() => {
    if (fallbackKind === "header") return "Linket";
    if (fallbackKind === "avatar") return toMonogram(fallbackLabel, 2);
    if (fallbackKind === "logo") return toMonogram(fallbackLabel, 1);
    return "L";
  }, [fallbackKind, fallbackLabel]);

  return (
    <>
      <Image
        {...props}
        src={src}
        alt={alt}
        onLoad={(event) => {
          setLoadState("ready");
          onLoad?.(event);
        }}
        onError={(event) => {
          setLoadState("error");
          onError?.(event);
        }}
        className={cn(
          "public-profile-image-transition",
          isReady ? "public-profile-image-ready" : "public-profile-image-pending",
          loadState === "error" && "public-profile-image-hidden",
          className
        )}
      />
      {!isReady ? (
        <span
          aria-hidden
          data-state={loadState === "error" ? "error" : "loading"}
          className={cn(
            "public-profile-image-fallback absolute inset-0",
            fallbackKind === "avatar" && "public-profile-image-fallback-avatar",
            fallbackKind === "header" && "public-profile-image-fallback-header",
            fallbackKind === "logo" && "public-profile-image-fallback-logo",
            fallbackKind === "generic" && "public-profile-image-fallback-generic"
          )}
        >
          <span className="public-profile-image-fallback-label">
            {fallbackText}
          </span>
        </span>
      ) : null}
    </>
  );
}
