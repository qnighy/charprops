import { getNNNN } from "./nnnn.ts";

export type Codepoint = UnicodeCodepoint;
export type UnicodeCodepoint = {
  type: "UnicodeCodepoint";
  codepoint: number;
};
export function UnicodeCodepoint(codepoint: number): UnicodeCodepoint {
  return { type: "UnicodeCodepoint", codepoint };
}

export function parseCodepoint(text: string): Codepoint | null {
  const uMatch = /^u\+0*([0-9a-f]{1,6})$/i.exec(text);
  if (uMatch) {
    const codepoint = parseInt(uMatch[1], 16);
    if (codepoint >= 0 && codepoint <= 0x10ffff) {
      return UnicodeCodepoint(codepoint);
    }
  }

  return null;
}

export function stringifyCodepoint(codepoint: Codepoint): string {
  switch (codepoint.type) {
    case "UnicodeCodepoint":
      return `U+${getNNNN(codepoint.codepoint)}`;
  }
}
