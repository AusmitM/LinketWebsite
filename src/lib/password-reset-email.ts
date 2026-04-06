const PASSWORD_RESET_EMAIL_STORAGE_KEY = "linket:password-reset-email";

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function readPasswordResetEmail() {
  if (typeof window === "undefined") return null;

  try {
    return normalizeEmail(window.sessionStorage.getItem(PASSWORD_RESET_EMAIL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writePasswordResetEmail(email: string | null | undefined) {
  if (typeof window === "undefined") return;

  try {
    const normalized = normalizeEmail(email);
    if (normalized) {
      window.sessionStorage.setItem(PASSWORD_RESET_EMAIL_STORAGE_KEY, normalized);
      return;
    }
    window.sessionStorage.removeItem(PASSWORD_RESET_EMAIL_STORAGE_KEY);
  } catch {
    // Ignore storage failures in restricted browsing contexts.
  }
}
