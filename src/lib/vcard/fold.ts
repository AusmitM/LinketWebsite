// Fold a line per RFC6350 section 3.2: no more than 75 octets per line.
// Continuation lines start with a single space. Count bytes in UTF-8.

function utf8Bytes(s: string): number {
  // Fast UTF-8 byte length
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // surrogate pair
      i++; bytes += 4;
    } else bytes += 3;
  }
  return bytes;
}

export function foldLine(line: string, limit = 75): string[] {
  if (utf8Bytes(line) <= limit) return [line];
  const out: string[] = [];
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = current + ch;
    if (utf8Bytes(next) > limit) {
      out.push(current);
      current = " " + ch; // start continuation with space
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

