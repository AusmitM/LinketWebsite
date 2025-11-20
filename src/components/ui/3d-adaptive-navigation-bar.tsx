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
    <div className="w-full max-w-5xl">
      <nav
        role="tablist"
        aria-label="Site sections"
        className="relative grid w-full grid-cols-1 gap-3 rounded-full border border-[#f7c7b3] bg-white/90 p-2 shadow-[0_25px_50px_rgba(255,151,118,0.2)] sm:grid-cols-2 lg:flex lg:items-center lg:gap-3"
        style={{
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {items.map((item) => {
          const isActive = Boolean(activeId && item.id === activeId);
          const accentGradient =
            item.gradient ?? "linear-gradient(120deg,#ff9776,#fdd09f)";
          const accentShadow =
            item.shadow ?? "0 12px 30px rgba(255,151,118,0.25)";

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold uppercase tracking-[0.08em] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#febf9b]",
                isActive ? "text-[#0b1220]" : "text-[#606b85]"
              )}
              style={{
                backgroundImage: isActive ? accentGradient : undefined,
                border: "none",
                backgroundColor: isActive ? undefined : "rgba(255,255,255,0.8)",
                boxShadow: isActive
                  ? accentShadow
                  : "inset 0 0 0 1px rgba(238,240,249,0.8)",
                minWidth: "120px",
              }}
              onClick={() => handleSectionClick(item.id)}
            >
              <span className="whitespace-normal text-center leading-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
