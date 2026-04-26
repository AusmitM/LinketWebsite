"use client";

import { useMemo, useState } from "react";
import { getLinkFaviconCandidates } from "@/lib/link-favicon";
import { cn } from "@/lib/utils";

type LinkFaviconProps = {
  title: string;
  url: string;
  useDarkThemeIcons?: boolean;
  apiVersion?: string;
  className?: string;
  fallbackClassName?: string;
  loading?: "eager" | "lazy";
};

function toLinkMonogram(title: string) {
  const cleaned = title.trim();
  if (!cleaned) return "L";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (!words.length) return "L";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export default function LinkFavicon({
  title,
  url,
  useDarkThemeIcons = false,
  apiVersion = "3",
  className,
  fallbackClassName,
  loading = "lazy",
}: LinkFaviconProps) {
  const sources = useMemo(
    () =>
      getLinkFaviconCandidates(url, {
        apiVersion,
        darkTheme: useDarkThemeIcons,
      }),
    [apiVersion, url, useDarkThemeIcons]
  );
  const sourceKey = useMemo(() => sources.join("|"), [sources]);
  const [attempt, setAttempt] = useState({ key: sourceKey, index: 0 });
  const monogram = useMemo(() => toLinkMonogram(title), [title]);
  const index = attempt.key === sourceKey ? attempt.index : 0;
  const src = sources[index] ?? null;

  if (!src) {
    return (
      <span
        className={cn(
          className,
          "inline-flex shrink-0 items-center justify-center overflow-hidden text-xs font-semibold uppercase",
          fallbackClassName
        )}
        aria-hidden
      >
        {monogram}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      loading={loading}
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onLoad={(event) => {
        const image = event.currentTarget;
        if (image.naturalWidth <= 1 && image.naturalHeight <= 1) {
          setAttempt((current) => ({
            key: sourceKey,
            index:
              current.key === sourceKey ? current.index + 1 : 1,
          }));
        }
      }}
      onError={() => {
        setAttempt((current) => ({
          key: sourceKey,
          index:
            current.key === sourceKey ? current.index + 1 : 1,
        }));
      }}
      className={className}
      aria-hidden
    />
  );
}
