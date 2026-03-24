import Image from "next/image";

import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

type PublicProfilePreviewLoaderProps = {
  className?: string;
  fullscreen?: boolean;
  overlay?: boolean;
  label?: string;
};

export default function PublicProfilePreviewLoader({
  className,
  fullscreen = false,
  overlay = false,
  label = "Preparing preview",
}: PublicProfilePreviewLoaderProps) {
  const markSrc = brand.logomark || brand.logo;

  return (
    <div
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden px-5 py-6 text-center text-foreground",
        fullscreen ? "min-h-screen" : "h-full min-h-[260px]",
        overlay ? "absolute inset-0 z-10 bg-background/90 backdrop-blur-[3px]" : "bg-background",
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading public profile preview"
    >
      <div className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-6 right-8 h-28 w-28 rounded-full bg-accent/14 blur-3xl" />

      <div className="relative flex w-full max-w-[264px] flex-col items-center gap-4 rounded-[32px] border border-border/60 bg-card/88 px-6 py-7 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.5)]">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        <div className="relative flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-[-6px] rounded-[30px] border border-dashed border-primary/25 animate-[spin_8s_linear_infinite]" />
          <span className="absolute inset-[1px] rounded-[28px] border border-border/70 bg-background/92 shadow-inner" />
          <span className="absolute inset-[11px] rounded-[21px] bg-[radial-gradient(circle_at_28%_28%,hsl(var(--accent)/0.24),transparent_54%),radial-gradient(circle_at_72%_72%,hsl(var(--primary)/0.22),transparent_58%)] animate-pulse" />
          <span className="absolute inset-[15px] rounded-[18px] border border-white/15" />
          {markSrc ? (
            <Image
              src={markSrc}
              alt=""
              width={44}
              height={44}
              aria-hidden
              className="relative h-11 w-11 object-contain drop-shadow-[0_8px_18px_rgba(15,23,42,0.18)]"
            />
          ) : (
            <span className="relative text-base font-semibold tracking-[0.08em] text-primary">
              LK
            </span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold tracking-[0.01em] text-foreground">
            {label}
          </p>
          <div className="flex items-center justify-center gap-1.5" aria-hidden>
            <span className="h-1.5 w-12 rounded-full bg-primary/75 animate-pulse" />
            <span className="h-1.5 w-3 rounded-full bg-primary/45 animate-pulse [animation-delay:180ms]" />
            <span className="h-1.5 w-3 rounded-full bg-accent/45 animate-pulse [animation-delay:360ms]" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading public profile preview.</span>
    </div>
  );
}
