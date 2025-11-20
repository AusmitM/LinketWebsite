"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  id: string;
  gradient?: string;
  shadow?: string;
}

interface AdaptiveNavPillProps {
  items: readonly NavItem[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
}

/**
 * Minimal, glassy navigation bar used across the landing page.
 * Rebuilt to rely on simple CSS so only the active section stays highlighted.
 */
export function AdaptiveNavPill({
  items,
  activeId,
  onSelect,
}: AdaptiveNavPillProps) {
  const handleSectionClick = React.useCallback(
    (sectionId: string) => {
      onSelect?.(sectionId);
    },
    [onSelect]
  );

  return (
    <nav
      role="tablist"
      aria-label="Site sections"
      className="relative flex w-full items-center gap-2 rounded-full border border-white/50 bg-white/80 p-2 shadow-[0_35px_80px_rgba(255,151,118,0.25)]"
      style={{
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {items.map((item) => {
        const isActive = Boolean(activeId && item.id === activeId);
        const accentGradient =
          item.gradient ?? "linear-gradient(120deg,#ff9776,#7fc8e8)";
        const accentShadow = item.shadow ?? "0 14px 32px rgba(15,23,42,0.16)";

        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex-1 rounded-full px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.12em] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,255,255,0.8)]",
              isActive ? "text-[#0b1220]" : "text-[rgba(15,23,42,0.65)]"
            )}
            style={{
              backgroundImage: isActive ? accentGradient : undefined,
              backgroundSize: "140% 140%",
              backgroundPosition: "center",
              border: isActive
                ? "1px solid rgba(255,255,255,0.7)"
                : "1px solid rgba(15,23,42,0.1)",
              opacity: isActive ? 1 : 0.75,
              boxShadow: isActive
                ? accentShadow
                : "inset 0 0 0 1px rgba(255,255,255,0.3)",
              transform: isActive ? "translateY(-1px)" : "translateY(0)",
              backgroundColor: isActive ? undefined : "rgba(255,255,255,0.55)",
              minWidth: 108,
            }}
            onClick={() => handleSectionClick(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
