const RESERVED_PUBLIC_ROUTES = new Set([
  "",
  "dashboard",
  "auth",
  "forgot-password",
  "profile",
  "admin",
  "pricing",
  "about",
  "blog",
  "careers",
  "press",
  "contact",
  "guides",
  "status",
  "privacy",
  "terms",
  "returns",
  "accessibility",
]);

export function isPublicProfilePathname(pathname: string | null | undefined) {
  if (!pathname) return false;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "u" && parts.length >= 2) return true;
  if (parts.length !== 1) return false;
  const segment = parts[0] ?? "";
  return !RESERVED_PUBLIC_ROUTES.has(segment);
}
