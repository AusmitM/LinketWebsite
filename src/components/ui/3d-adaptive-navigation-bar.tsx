"use client";

import React from "react";
import { motion, useSpring } from "framer-motion";

export interface NavItem {
  label: string;
  id: string;
  gradient?: string;
  shadow?: string;
}

interface AdaptiveNavPillProps {
  items: NavItem[];
  activeId: string;
  onSelect?: (id: string) => void;
}

/**
 * Minimal, glassy navigation bar used across the landing page.
 * Each section can define a gradient + shadow so its chip feels bespoke.
 */
export function AdaptiveNavPill({
  items,
  activeId,
  onSelect,
}: AdaptiveNavPillProps) {
  const expandedWidth = Math.min(150 + items.length * 110, 760);
  const pillWidth = useSpring(expandedWidth, {
    stiffness: 220,
    damping: 25,
    mass: 1,
  });

  const handleSectionClick = (sectionId: string) => {
    onSelect?.(sectionId);
  };

  return (
    <motion.nav
      className="relative rounded-full border border-white/50 bg-white/70 shadow-[0_35px_80px_rgba(255,151,118,0.25)]"
      style={{
        width: pillWidth,
        height: "64px",
        padding: "0.5rem 0.65rem",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      <div
        className="flex h-full w-full items-center gap-2.5"
        style={{
          fontFamily:
            '"Geist", "Inter", -apple-system, BlinkMacSystemFont, "SF Pro", Poppins, sans-serif',
        }}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          const accentGradient =
            item.gradient ?? "linear-gradient(120deg,#ff9776,#7fc8e8)";
          const accentShadow = item.shadow ?? "0 14px 32px rgba(15,23,42,0.16)";
          return (
            <button
              key={item.id}
              type="button"
              className="relative flex-1 rounded-full px-4 py-3 text-[0.72rem] uppercase tracking-[0.12em] transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,255,255,0.8)]"
              style={{
                backgroundImage: accentGradient,
                backgroundSize: "140% 140%",
                backgroundPosition: "center",
                border: "1px solid rgba(255,255,255,0.55)",
                color: isActive ? "#0b1220" : "rgba(15,23,42,0.68)",
                fontWeight: isActive ? 700 : 500,
                letterSpacing: "0.12em",
                opacity: isActive ? 0.98 : 0.55,
                boxShadow: isActive
                  ? accentShadow
                  : "inset 0 0 0 1px rgba(255,255,255,0.35)",
                transform: isActive ? "translateY(-1px)" : "translateY(0)",
                minWidth: 108,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "nowrap",
              }}
              onClick={() => handleSectionClick(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </motion.nav>
  );
}
