export function confirmRemove(
  message = "Are you sure you want to remove this?"
): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}
