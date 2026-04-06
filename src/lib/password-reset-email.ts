const PASSWORD_RESET_EMAIL_STORAGE_KEY = "linket:password-reset-email";
const PASSWORD_RESET_VERIFICATION_STORAGE_KEY =
  "linket:password-reset-verification";
const PASSWORD_RESET_SESSION_STORAGE_KEY = "linket:password-reset-session";
const PASSWORD_RESET_VERIFICATION_TTL_MS = 15 * 60 * 1000;

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

type PasswordResetVerification = {
  email: string;
  verifiedAt: number;
};

type PasswordResetSession = {
  accessToken: string;
  refreshToken: string;
  email: string;
  verifiedAt: number;
};

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

export function readPasswordResetVerification() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(
      PASSWORD_RESET_VERIFICATION_STORAGE_KEY
    );
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PasswordResetVerification> | null;
    const email = normalizeEmail(parsed?.email);
    const verifiedAt =
      typeof parsed?.verifiedAt === "number" ? parsed.verifiedAt : null;

    if (!email || !verifiedAt) {
      window.sessionStorage.removeItem(PASSWORD_RESET_VERIFICATION_STORAGE_KEY);
      return null;
    }

    if (Date.now() - verifiedAt > PASSWORD_RESET_VERIFICATION_TTL_MS) {
      window.sessionStorage.removeItem(PASSWORD_RESET_VERIFICATION_STORAGE_KEY);
      return null;
    }

    return { email, verifiedAt };
  } catch {
    return null;
  }
}

export function writePasswordResetVerification(email: string | null | undefined) {
  if (typeof window === "undefined") return;

  try {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      window.sessionStorage.removeItem(PASSWORD_RESET_VERIFICATION_STORAGE_KEY);
      return;
    }

    const payload: PasswordResetVerification = {
      email: normalized,
      verifiedAt: Date.now(),
    };
    window.sessionStorage.setItem(
      PASSWORD_RESET_VERIFICATION_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage failures in restricted browsing contexts.
  }
}

export function clearPasswordResetVerification() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(PASSWORD_RESET_VERIFICATION_STORAGE_KEY);
  } catch {
    // Ignore storage failures in restricted browsing contexts.
  }
}

export function readPasswordResetSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(PASSWORD_RESET_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PasswordResetSession> | null;
    const email = normalizeEmail(parsed?.email);
    const accessToken =
      typeof parsed?.accessToken === "string" ? parsed.accessToken.trim() : "";
    const refreshToken =
      typeof parsed?.refreshToken === "string" ? parsed.refreshToken.trim() : "";
    const verifiedAt =
      typeof parsed?.verifiedAt === "number" ? parsed.verifiedAt : null;

    if (!email || !accessToken || !refreshToken || !verifiedAt) {
      window.sessionStorage.removeItem(PASSWORD_RESET_SESSION_STORAGE_KEY);
      return null;
    }

    if (Date.now() - verifiedAt > PASSWORD_RESET_VERIFICATION_TTL_MS) {
      window.sessionStorage.removeItem(PASSWORD_RESET_SESSION_STORAGE_KEY);
      return null;
    }

    return {
      accessToken,
      refreshToken,
      email,
      verifiedAt,
    };
  } catch {
    return null;
  }
}

export function writePasswordResetSession(args: {
  accessToken: string;
  refreshToken: string;
  email: string;
}) {
  if (typeof window === "undefined") return;

  try {
    const email = normalizeEmail(args.email);
    const accessToken = args.accessToken.trim();
    const refreshToken = args.refreshToken.trim();

    if (!email || !accessToken || !refreshToken) {
      window.sessionStorage.removeItem(PASSWORD_RESET_SESSION_STORAGE_KEY);
      return;
    }

    const payload: PasswordResetSession = {
      accessToken,
      refreshToken,
      email,
      verifiedAt: Date.now(),
    };

    window.sessionStorage.setItem(
      PASSWORD_RESET_SESSION_STORAGE_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore storage failures in restricted browsing contexts.
  }
}

export function clearPasswordResetSession() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(PASSWORD_RESET_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures in restricted browsing contexts.
  }
}
