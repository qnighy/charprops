import { getNNNN } from "./nnnn.ts";

export type CodePoint = UnicodeCodePoint;
export type UnicodeCodePoint = {
  type: "UnicodeCodePoint";
  codepoint: number;
};
export function UnicodeCodePoint(codepoint: number): UnicodeCodePoint {
  return { type: "UnicodeCodePoint", codepoint };
}

export function parseCodePoint(text: string): CodePoint | null {
  const uMatch = /^u\+0*([0-9a-f]{1,6})$/i.exec(text);
  if (uMatch) {
    const codepoint = parseInt(uMatch[1], 16);
    if (codepoint >= 0 && codepoint <= 0x10ffff) {
      return UnicodeCodePoint(codepoint);
    }
  }

  return null;
}

export function stringifyCodePoint(codepoint: CodePoint): string {
  switch (codepoint.type) {
    case "UnicodeCodePoint":
      return `U+${getNNNN(codepoint.codepoint)}`;
  }
}
