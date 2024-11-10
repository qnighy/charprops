import { deriveNoncharacterName, deriveReservedName } from "../ucd/name.ts";
import type { BidiClass, DecompositionType, GeneralCategoryAbbr, NumericType } from "../ucd/parser.ts";
import { expandFlags } from "./flags.ts";
import { DB } from "./worker-client.ts";

export type CodePointData = {
  codepoint: number;
  name: string;
  generalCategory: GeneralCategoryAbbr;
  canonicalCombiningClass: number;
  bidiClass: BidiClass;
  decompositionType: DecompositionType | undefined;
  numericType: NumericType | undefined;
  bidiMirrored: boolean;
};

export async function readCodePoint(db: DB, codepoint: number): Promise<CodePointData> {
  const result = await db.query<[codepoint: number, name: string, flags1: number]>("SELECT codepoint, name, flags FROM codepoints WHERE codepoint = $1 LIMIT 1", [codepoint]);
  if (result.length === 0) {
    // TODO: branch for noncharacters should be unnecessary here
    // once PropList.txt is integrated.
    const isNoncharacter =
      0xFDD0 <= codepoint && codepoint <= 0xFDEF ||
      (codepoint & 0xFFFF) === 0xFFFE || (codepoint & 0xFFFF) === 0xFFFF;
    // Unassigned code point; use default values
    return {
      codepoint,
      name: isNoncharacter ? deriveNoncharacterName(codepoint) : deriveReservedName(codepoint),
      generalCategory: 'Cn',
      canonicalCombiningClass: 0,
      // TODO: Bidi_Class has complex default values
      bidiClass: 'L',
      decompositionType: undefined,
      numericType: undefined,
      bidiMirrored: false,
    };
  }
  const [[respCodepoint, name, flags1]] = result;
  const expandedFlags = expandFlags({ flags1 });
  return {
    codepoint: respCodepoint,
    name,
    ...expandedFlags,
  };
}
