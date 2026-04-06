"use client";

const PASSWORD_RESET_EMAIL_STORAGE_KEY = "linket:password-reset-email";
const PASSWORD_RESET_VERIFICATION_STORAGE_KEY =
  "linket:password-reset-verification";
const PASSWORD_RESET_SESSION_STORAGE_KEY = "linket:password-reset-session";

type PasswordResetVerificationState = {
  email: string;
};

type PasswordResetSessionState = {
  accessToken: string;
  refreshToken: string;
  email: string;
};

function readSessionStorage(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSessionStorage(key: string, value: string) {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeSessionStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
}

function normalizeEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase() ?? "";
  return normalized || null;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function readPasswordResetEmail() {
  return normalizeEmail(readSessionStorage(PASSWORD_RESET_EMAIL_STORAGE_KEY));
}

export function writePasswordResetEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    removeSessionStorage(PASSWORD_RESET_EMAIL_STORAGE_KEY);
    return;
  }

  writeSessionStorage(PASSWORD_RESET_EMAIL_STORAGE_KEY, normalizedEmail);
}

export function readPasswordResetVerification():
  | PasswordResetVerificationState
  | null {
  const parsed = parseJson<{ email?: string }>(
    readSessionStorage(PASSWORD_RESET_VERIFICATION_STORAGE_KEY)
  );
  const email = normalizeEmail(parsed?.email);
  if (!email) return null;
  return { email };
}

export function writePasswordResetVerification(email: string) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    removeSessionStorage(PASSWORD_RESET_VERIFICATION_STORAGE_KEY);
    return;
  }

  writeSessionStorage(
    PASSWORD_RESET_VERIFICATION_STORAGE_KEY,
    JSON.stringify({ email: normalizedEmail })
  );
}

export function clearPasswordResetVerification() {
  removeSessionStorage(PASSWORD_RESET_VERIFICATION_STORAGE_KEY);
}

export function readPasswordResetSession(): PasswordResetSessionState | null {
  const parsed = parseJson<{
    accessToken?: string;
    refreshToken?: string;
    email?: string;
  }>(readSessionStorage(PASSWORD_RESET_SESSION_STORAGE_KEY));

  const accessToken = parsed?.accessToken?.trim() ?? "";
  const refreshToken = parsed?.refreshToken?.trim() ?? "";
  const email = normalizeEmail(parsed?.email);

  if (!accessToken || !refreshToken || !email) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    email,
  };
}

export function writePasswordResetSession(session: PasswordResetSessionState) {
  const accessToken = session.accessToken?.trim() ?? "";
  const refreshToken = session.refreshToken?.trim() ?? "";
  const email = normalizeEmail(session.email);

  if (!accessToken || !refreshToken || !email) {
    removeSessionStorage(PASSWORD_RESET_SESSION_STORAGE_KEY);
    return;
  }

  writeSessionStorage(
    PASSWORD_RESET_SESSION_STORAGE_KEY,
    JSON.stringify({
      accessToken,
      refreshToken,
      email,
    })
  );
}

export function clearPasswordResetSession() {
  removeSessionStorage(PASSWORD_RESET_SESSION_STORAGE_KEY);
}
