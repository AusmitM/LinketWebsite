export const CSRF_COOKIE_NAME = "linket_csrf";
export const CSRF_HEADER_NAME = "x-linket-csrf";

export function getBrowserCsrfToken() {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName !== CSRF_COOKIE_NAME) continue;
    const encoded = rawValue.join("=");
    if (!encoded) return null;
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return null;
}
