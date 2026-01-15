"use client";

import { motion, useReducedMotion } from "framer-motion";

type Props = {
  name: string;
  tagline?: string;
  avatar: string | null;
  textColor?: string;
  haloColor?: string;
  mutedColor?: string;
};

export function ProfileHeader({ name, tagline, avatar, textColor = "#0f172a", haloColor = "rgba(190, 230, 253, 0.6)", mutedColor = "#64748b" }: Props) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <div className="flex items-center gap-4" style={{ color: textColor }}>
      <span className="relative inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-[var(--avatar-border)] bg-background">
        <span
          className="absolute inset-0 -z-10 rounded-full"
          aria-hidden
          style={{
            background: `radial-gradient(60% 60% at 50% 40%, ${haloColor} 0%, transparent 70%)`,
            filter: "blur(6px)",
          }}
        />
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={`${name} avatar`} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl font-semibold" style={{ color: textColor }}>
            {name?.[0]?.toUpperCase() ?? "U"}
          </span>
        )}
      </span>
      <div>
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-2xl font-semibold"
        >
          {name}
        </motion.div>
        {tagline && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="text-sm"
            style={{ color: mutedColor }}
          >
            {tagline}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default ProfileHeader;
