import type { Lead, LeadFlag } from "@/types/db";

export type { LeadFlag } from "@/types/db";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const LEGACY_LEAD_STATUS_MAP: Record<string, LeadFlag> = {
  need_follow_up: "follow_up",
  hot: "follow_up",
  needs_pricing: "follow_up",
  book_demo: "follow_up",
  qualified: "follow_up",
  followed_up: "done",
  archived: "done",
  spam: "done",
};
const LEGACY_LEAD_RATING_MAP: Record<string, number> = {
  need_follow_up: 3,
  hot: 5,
  needs_pricing: 4,
  book_demo: 4,
  qualified: 3,
  followed_up: 2,
  archived: 1,
  spam: 1,
};

export const LEAD_FLAG_LABELS: Record<LeadFlag, string> = {
  follow_up: "Follow up",
  done: "Done",
};

const LEAD_FLAG_BADGE_CLASSES: Record<LeadFlag, string> = {
  follow_up:
    "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100",
  done:
    "border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100",
};

export function isLeadFlag(value: unknown): value is LeadFlag {
  return typeof value === "string" && value in LEAD_FLAG_LABELS;
}

export function normalizeLeadFlag(
  value: unknown,
  fallback: LeadFlag = "follow_up"
) {
  if (typeof value === "string") {
    if (value in LEAD_FLAG_LABELS) {
      return value as LeadFlag;
    }
    return LEGACY_LEAD_STATUS_MAP[value] ?? fallback;
  }
  return fallback;
}

export function normalizeLeadRating(
  value: unknown,
  fallback = 3
) {
  const rating =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(rating)) {
    return clampLeadRating(fallback);
  }
  return clampLeadRating(Math.round(rating));
}

export function getDefaultLeadRating(flag: unknown) {
  if (typeof flag === "string" && flag in LEGACY_LEAD_RATING_MAP) {
    return LEGACY_LEAD_RATING_MAP[flag];
  }
  if (flag === "done") return 2;
  return 3;
}

export function getLeadRatingLabel(rating: number) {
  const normalized = normalizeLeadRating(rating);
  return `${normalized} star${normalized === 1 ? "" : "s"}`;
}

export function getLeadFlagLabel(flag: LeadFlag) {
  return LEAD_FLAG_LABELS[flag];
}

export function getLeadFlagBadgeClassName(flag: LeadFlag) {
  return LEAD_FLAG_BADGE_CLASSES[flag];
}

export function getDefaultFollowUpAt(base: string | Date = new Date()) {
  const source = typeof base === "string" ? new Date(base) : new Date(base);
  const next = Number.isNaN(source.getTime()) ? new Date() : source;
  next.setDate(next.getDate() + 1);
  return next.toISOString();
}

export function getLeadReminderTimestamp(
  lead: Pick<Lead, "created_at" | "next_follow_up_at">
) {
  const fallback = new Date(lead.created_at);
  fallback.setDate(fallback.getDate() + 1);
  const target = lead.next_follow_up_at
    ? new Date(lead.next_follow_up_at)
    : fallback;
  return Number.isNaN(target.getTime()) ? fallback.getTime() : target.getTime();
}

export function getLeadPriorityScore(
  lead: Pick<Lead, "created_at" | "next_follow_up_at" | "lead_flag" | "lead_rating">
) {
  const statusPenalty = lead.lead_flag === "done" ? 30 * DAY_MS : 0;
  const ratingPenalty = (5 - normalizeLeadRating(lead.lead_rating)) * 6 * HOUR_MS;
  return getLeadReminderTimestamp(lead) + statusPenalty + ratingPenalty;
}

export function compareLeadsByPriority(a: Lead, b: Lead) {
  const statusDiff = leadStatusPriority(a.lead_flag) - leadStatusPriority(b.lead_flag);
  if (statusDiff !== 0) return statusDiff;

  const ratingDiff =
    normalizeLeadRating(b.lead_rating) - normalizeLeadRating(a.lead_rating);
  if (ratingDiff !== 0) return ratingDiff;

  const reminderDiff = getLeadReminderTimestamp(a) - getLeadReminderTimestamp(b);
  if (reminderDiff !== 0) return reminderDiff;

  const diff = getLeadPriorityScore(a) - getLeadPriorityScore(b);
  if (diff !== 0) return diff;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortLeadsByPriority(leads: Lead[]) {
  return [...leads].sort(compareLeadsByPriority);
}

export function compareLeadsByReminder(a: Lead, b: Lead) {
  const statusDiff = leadStatusPriority(a.lead_flag) - leadStatusPriority(b.lead_flag);
  if (statusDiff !== 0) return statusDiff;

  const diff = getLeadReminderTimestamp(a) - getLeadReminderTimestamp(b);
  if (diff !== 0) return diff;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortLeadsByReminder(leads: Lead[]) {
  return [...leads].sort(compareLeadsByReminder);
}

function clampLeadRating(value: number) {
  if (!Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, value));
}

function leadStatusPriority(flag: LeadFlag) {
  return flag === "done" ? 1 : 0;
}
