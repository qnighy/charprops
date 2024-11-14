import { AsyncConnection } from "../sqlite.ts";
import { deriveNoncharacterName, deriveReservedName } from "../ucd/name.ts";
import type { BidiClass, DecompositionType, GeneralCategoryAbbr, NumericType } from "../ucd/parser.ts";
import { expandFlags } from "./flags.ts";

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

export async function readCodePoint(db: AsyncConnection, codepoint: number): Promise<CodePointData> {
  const result = (await db.executeRows("SELECT codepoint, name, flags1 FROM codepoints WHERE codepoint = :codepoint LIMIT 1", { codepoint })) as {
    codepoint: number;
    name: string;
    flags1: number;
  }[];
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
  const { codepoint: respCodepoint, name, flags1 } = result[0];
  const expandedFlags = expandFlags({ flags1 });
  return {
    codepoint: respCodepoint,
    name,
    ...expandedFlags,
  };
}
