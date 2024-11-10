import * as path from "$std/path/mod.ts";
import { lines } from "../lines.ts";
import { downloadUCD } from "../ucd/download.ts";
import { deriveName } from "../ucd/name.ts";
import { parseUnicodeData } from "../ucd/parser.ts";
import { connectSync } from "./conn.ts";
import { CustomDisposable } from "../raii.ts";
import { compressFlags } from "./flags.ts";

export async function setup() {
  using dbOwner = new CustomDisposable(connectSync(), (db) => db.close());
  const db = dbOwner.resource;
  db.execute(`
    DROP INDEX IF EXISTS codepoint_taggings_by_tag;
    DROP TABLE IF EXISTS codepoint_taggings;
    DROP INDEX IF EXISTS codepoints_name;
    DROP TABLE IF EXISTS codepoints;

    CREATE TABLE codepoints (
      codepoint INTEGER PRIMARY KEY,
      name      TEXT,
      flags     INTEGER
    );

    CREATE INDEX codepoints_name ON codepoints (name);

    CREATE TABLE codepoint_taggings (
      codepoint INTEGER,
      tag_id    INTEGER,
      tag_value INTEGER,
      PRIMARY KEY (codepoint, tag_id)
    );

    CREATE INDEX codepoint_taggings_by_tag ON codepoint_taggings (tag_id, tag_value);
  `);

  const ucdPath = await downloadUCD();

  type InsertCodepointParams = {
    codepoint: number;
    name: string;
    flags: number;
  };
  using insertCodepoint = new CustomDisposable(db.prepareQuery<unknown[], Record<string, unknown>, InsertCodepointParams>(`
    INSERT INTO codepoints (codepoint, name, flags)
    VALUES (:codepoint, :name, :flags);
  `), (query) => query.finalize());
  const bulkInsertCodepoint = (rows: InsertCodepointParams[]) => {
    db.transaction(() => {
      for (const row of rows) {
        insertCodepoint.resource.execute(row);
      }
    });
    console.log(`Inserted ${rows.length} codepoints`);
  };
  let bulkRows: InsertCodepointParams[] = [];
  const unicodeData = await Deno.open(path.join(ucdPath, "UnicodeData.txt"));
  for await (const row of parseUnicodeData(lines(unicodeData.readable))) {
    const { codepoint: codepointOrRange, name: nameData } = row;
    const startCodepoint = codepointOrRange.type === "CodePointRange" ? codepointOrRange.start : codepointOrRange.codepoint;
    const endCodepoint = codepointOrRange.type === "CodePointRange" ? codepointOrRange.end : startCodepoint;
    for (let codepoint = startCodepoint; codepoint <= endCodepoint; codepoint++) {
      const name = nameData.type === "DerivableName" ? deriveName(nameData.label, codepoint) : nameData.name;
      const flags = compressFlags({
        generalCategory: row.generalCategory,
        canonicalCombiningClass: row.canonicalCombiningClass,
        bidiClass: row.bidiClass,
        decompositionType: row.decomposition?.decompositionType,
        numericType: row.numeric?.numericType,
        bidiMirrored: row.bidiMirrored,
      });
      bulkRows.push({
        codepoint,
        name,
        flags: flags.flags1,
      });
      if (bulkRows.length >= 1000) {
        bulkInsertCodepoint(bulkRows);
        bulkRows = [];
      }
    }
  }
  if (bulkRows.length > 0) {
    bulkInsertCodepoint(bulkRows);
  }
}

if (import.meta.main) {
  await setup();
}
