// Escaping per RFC6350 (vCard 4.0):
// - Backslash -> \\
// - Comma -> \,
// - Semicolon -> \;
// - Newline (CR or LF) -> \n
export function escapeText(input: string | undefined | null): string {
  if (!input) return "";
  return String(input)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

