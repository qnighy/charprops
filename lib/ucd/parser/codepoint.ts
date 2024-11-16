export function parseCodepoint(text: string): number {
  // TODO: handle U+ added in Unihan
  if (!/^[0-9a-f]{4,6}$/i.test(text)) {
    throw new SyntaxError(`Invalid code point: ${text}`);
  }
  const cp = parseInt(text, 16);
  // Deliberately allowing surrogates
  if (cp < 0 || cp > 0x10FFFF) {
    throw new SyntaxError(`Invalid code point: ${text}`);
  }
  return cp;
}
export type CodepointOrRange = CodepointData | CodepointRange;
export type CodepointData = {
  type: "Codepoint";
  codepoint: number;
};
export function CodepointData(codepoint: number): CodepointData {
  return { type: "Codepoint", codepoint };
}
export type CodepointRange = {
  type: "CodepointRange";
  start: number;
  end: number;
};
export function CodepointRange(start: number, end: number): CodepointRange {
  return { type: "CodepointRange", start, end };
}

export function parseCodepointOrRange(text: string): CodepointOrRange {
  const parts = text.split('..');
  if (parts.length === 0) {
    throw new SyntaxError(`Invalid code point: ${text}`);
  } else if (parts.length === 1) {
    return CodepointData(parseCodepoint(parts[0]));
  } else if (parts.length === 2) {
    return CodepointRange(parseCodepoint(parts[0]), parseCodepoint(parts[1]));
  } else {
    throw new SyntaxError(`Invalid code point range: ${text}`);
  }
}

export function parseUSV(text: string): number {
  const cp = parseCodepoint(text);
  if (0xD800 <= cp && cp < 0xE000) {
    throw new SyntaxError(`Surrogate is not a USV: ${text}`);
  }
  return cp;
}

export function parseCodepointString(text: string): string {
  const parts = text.split(/\s+/);
  return parts.map((part) => String.fromCodePoint(parseUSV(part))).join('');
}
