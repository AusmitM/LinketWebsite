import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";

export type DashboardTourStatus = "started" | "completed" | "dismissed";

export const DASHBOARD_TOUR_VERSION = "v1";
export const DASHBOARD_TOUR_STATUS_EVENT = "linket:onboarding-tour:status";

export function getDashboardTourStorageKey(userId: string) {
  return `linket:onboarding-tour:${DASHBOARD_TOUR_VERSION}:${userId}`;
}

export function getDashboardTourAutoOpenStorageKey(userId: string) {
  return `linket:onboarding-tour:auto-open:${DASHBOARD_TOUR_VERSION}:${userId}`;
}

export function readDashboardTourStatus(
  key: string | null
): DashboardTourStatus | null {
  if (!key) return null;
  const raw = readLocalStorage(key);
  if (
    raw === "started" ||
    raw === "completed" ||
    raw === "dismissed"
  ) {
    return raw;
  }
  return null;
}

export function writeDashboardTourStatus(
  key: string | null,
  status: DashboardTourStatus
) {
  if (!key) return false;
  const didWrite = writeLocalStorage(key, status);
  if (didWrite && typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(DASHBOARD_TOUR_STATUS_EVENT, {
        detail: { status },
      })
    );
  }
  return didWrite;
}

export function readDashboardTourAutoOpenSeen(key: string | null) {
  if (!key) return false;
  return readLocalStorage(key) === "1";
}

export function writeDashboardTourAutoOpenSeen(key: string | null) {
  if (!key) return false;
  return writeLocalStorage(key, "1");
}
