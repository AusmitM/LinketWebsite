export function normalizeClaimCodeInput(value: string | null | undefined) {
  if (!value) return "";
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatClaimCodeDisplay(value: string | null | undefined) {
  const cleaned = normalizeClaimCodeInput(value);
  if (!cleaned) return "";
  return [cleaned.slice(0, 4), cleaned.slice(4, 8), cleaned.slice(8, 12)]
    .filter(Boolean)
    .join("-");
}
