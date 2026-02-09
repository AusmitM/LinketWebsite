import { ContactProfile, Address, Email, Phone } from "@/lib/profile.store";
import { escapeText } from "./escape";
import { foldLine } from "./fold";

function joinCRLF(lines: string[]): string {
  return lines.join("\r\n") + "\r\n"; // ensure trailing CRLF
}

function toN(p: ContactProfile): string {
  // N:Family;Given;Additional;Prefix;Suffix
  return [escapeText(p.lastName), escapeText(p.firstName), escapeText(p.middleName), escapeText(p.prefix), escapeText(p.suffix)].join(";");
}

function toFN(p: ContactProfile): string {
  const parts = [p.prefix, p.firstName, p.middleName, p.lastName, p.suffix].filter(Boolean);
  return escapeText(parts.join(" ").replace(/\s+/g, " ")) || escapeText(p.handle);
}

function toAdr(a?: Address): string | null {
  if (!a) return null;
  const fields = [a.pobox, a.ext, a.street, a.city, a.region, a.postcode, a.country].map(escapeText);
  return fields.join(";");
}

function normalizeTel(v: string): string {
  // Very light normalization to digits + leading +
  const trimmed = v.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.replace(/[^0-9]/g, "");
  return trimmed.replace(/[^0-9]/g, "");
}

function toTel(t: Phone): string {
  const pref = t.pref ? ";PREF=1" : "";
  const type = `;TYPE=${t.type.toUpperCase()}`;
  const value = normalizeTel(t.value);
  return `TEL${type}${pref}:${escapeText(value)}`;
}

function toEmail(e: Email): string {
  const pref = e.pref ? ";PREF=1" : "";
  const type = `;TYPE=${e.type}`;
  return `EMAIL${type}${pref}:${escapeText(e.value)}`;
}

function toPhoto(p: ContactProfile): string | null {
  if (!p.photo) return null;
  const mime = p.photo.mime || (p.photo.dataUrl?.split(",")[0].match(/data:(.*?);base64/)?.[1] ?? undefined);
  const base64 = p.photo.dataUrl?.split(",")[1];
  if (base64 && base64.length * 0.75 <= 150 * 1024) {
    return `PHOTO;MEDIATYPE=${mime || "image/jpeg"}:${base64}`;
  }
  if (p.photo.url) {
    return `PHOTO;MEDIATYPE=${mime || "image/jpeg"}:${escapeText(p.photo.url)}`;
  }
  return null;
}

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function sanitizeNoteValue(
  rawNote: string | undefined,
  _phones: Phone[] | undefined
): string | null {
  const note = rawNote?.trim();
  if (!note) return null;

  // Some older records stored values like "note: ...".
  let sanitized = note.replace(/^\s*note\s*:\s*/i, "");

  // Strip any phone-like sequence from notes.
  sanitized = sanitized.replace(/(?:\+?\d[\d().\-\s]{5,}\d)/g, "");

  sanitized = sanitized
    .replace(/\b(?:phone(?: number)?|tel|mobile)\s*:\s*/gi, "")
    .replace(/[ \t]+/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();

  return sanitized || null;
}

function deriveLinkLabel(rawTitle: string | undefined, normalizedUrl: string, index: number): string {
  const title = rawTitle?.trim();
  if (title) return title;
  try {
    const hostname = new URL(normalizedUrl).hostname.replace(/^www\./i, "");
    if (hostname) return hostname;
  } catch {
    // Ignore URL parsing errors and fall through to generic label.
  }
  return `Link ${index + 1}`;
}

export function buildVCard(profile: ContactProfile): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:4.0");
  lines.push(`FN:${toFN(profile)}`);
  lines.push(`N:${toN(profile)}`);
  lines.push("KIND:individual");
  if (profile.org) lines.push(`ORG:${escapeText(profile.org)}`);
  if (profile.title) lines.push(`TITLE:${escapeText(profile.title)}`);
  if (profile.role) lines.push(`ROLE:${escapeText(profile.role)}`);
  (profile.phones || []).forEach((t) => lines.push(toTel(t)));
  (profile.emails || []).forEach((e) => lines.push(toEmail(e)));
  const adr = toAdr(profile.address);
  if (adr) lines.push(`ADR;TYPE=work:${adr}`);
  (profile.links || []).forEach((link, index) => {
    const normalizedUrl = normalizeUrl(link.url);
    if (!normalizedUrl) return;
    const label = deriveLinkLabel(link.title, normalizedUrl, index);
    const group = `item${index + 1}`;
    lines.push(`${group}.URL:${escapeText(normalizedUrl)}`);
    lines.push(`${group}.X-ABLabel:${escapeText(label)}`);
  });
  const sanitizedNote = sanitizeNoteValue(profile.note, profile.phones);
  if (sanitizedNote) lines.push(`NOTE:${escapeText(sanitizedNote)}`);
  const photo = toPhoto(profile);
  if (photo) lines.push(photo);
  lines.push(`UID:${escapeText(profile.uid || "urn:uuid:" + profile.handle)}`);
  lines.push(`REV:${new Date(profile.updatedAt || Date.now()).toISOString()}`);
  lines.push("END:VCARD");

  // Apply folding per line, then join with CRLF
  const folded = lines.flatMap((l) => foldLine(l));
  return joinCRLF(folded);
}
