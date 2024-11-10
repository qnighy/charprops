export function parseCodePoint(text: string): number {
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
export type CodePointOrRange = CodePointData | CodePointRange;
export type CodePointData = {
  type: "CodePoint";
  codepoint: number;
};
export function CodePointData(codepoint: number): CodePointData {
  return { type: "CodePoint", codepoint };
}
export type CodePointRange = {
  type: "CodePointRange";
  start: number;
  end: number;
};
export function CodePointRange(start: number, end: number): CodePointRange {
  return { type: "CodePointRange", start, end };
}

export function parseCodePointOrRange(text: string): CodePointOrRange {
  const parts = text.split('..');
  if (parts.length === 0) {
    throw new SyntaxError(`Invalid code point: ${text}`);
  } else if (parts.length === 1) {
    return CodePointData(parseCodePoint(parts[0]));
  } else if (parts.length === 2) {
    return CodePointRange(parseCodePoint(parts[0]), parseCodePoint(parts[1]));
  } else {
    throw new SyntaxError(`Invalid code point range: ${text}`);
  }
}
