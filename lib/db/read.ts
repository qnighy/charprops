import { AsyncConnection } from "../sqlite.ts";
import { deriveNoncharacterName, deriveReservedName } from "../ucd/name.ts";
import { compressFlags, type CompressedCodePointData } from "../flags.ts";
import { stringifyCodePoint } from "../codepoint.ts";

export async function readCodePoint(db: AsyncConnection, codepoint: number): Promise<CompressedCodePointData> {
  const result = await db.executeRows<{
    codepoint: number;
  }, {
    codepoint: number;
    name: string;
    flags1: number;
  }>("SELECT codepoint, name, flags1 FROM codepoints WHERE codepoint = :codepoint LIMIT 1", { codepoint });
  if (result.length === 0) {
    // TODO: branch for noncharacters should be unnecessary here
    // once PropList.txt is integrated.
    const isNoncharacter =
      0xFDD0 <= codepoint && codepoint <= 0xFDEF ||
      (codepoint & 0xFFFF) === 0xFFFE || (codepoint & 0xFFFF) === 0xFFFF;
    // Unassigned code point; use default values
    return compressFlags({
      codepoint,
      name: isNoncharacter ? deriveNoncharacterName(codepoint) : deriveReservedName(codepoint),
      generalCategory: 'Cn',
      canonicalCombiningClass: 0,
      // TODO: Bidi_Class has complex default values
      bidiClass: 'L',
      decompositionType: undefined,
      numericType: undefined,
      bidiMirrored: false,
    });
  }
  return result[0];
}

export async function readTag(db: AsyncConnection, tag: string): Promise<number | undefined> {
  const result = await db.executeRows<{
    tag_name: string;
  }, {
    tag_id: number;
  }>("SELECT tag_id FROM tags WHERE tag_name = :tag_name LIMIT 1", { tag_name: tag });
  if (result.length === 0) {
    return undefined;
  }
  return result[0].tag_id;
}

export type ReadTagCodepointsOptions = {
  after?: number;
  max?: number;
};

export async function readTagCodepoints(
  db: AsyncConnection,
  tagId: number,
  options: ReadTagCodepointsOptions = {},
): Promise<{ rows: CompressedCodePointData[], next: string | undefined }> {
  const { after = -1, max = 100 } = options;
  const result = await db.executeRows<{
    tag_id: number;
    after: number;
    limit: number;
  }, {
    codepoint: number;
    name: string;
    flags1: number;
  }>(`
    SELECT codepoints.codepoint, codepoints.name, codepoints.flags1
    FROM codepoint_taggings
    INNER JOIN codepoints USING (codepoint)
    WHERE tag_id = :tag_id AND codepoints.codepoint > :after
    ORDER BY codepoints.codepoint ASC
    LIMIT :limit;
  `, { tag_id: tagId, after, limit: max + 1 });

  return {
    rows: result.slice(0, max),
    next: result.length > max ? stringifyCodePoint({ type: "UnicodeCodePoint", codepoint: result[max].codepoint }) : undefined,
  };
}
