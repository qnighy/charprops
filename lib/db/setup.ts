import * as path from "$std/path/mod.ts";
import { lines } from "../lines.ts";
import { downloadUCD } from "../ucd/download.ts";
import { deriveName } from "../ucd/name.ts";
import { DerivableNameData, parseCodePoint, parseName, parseRow, RangeIdentifierStartData, RegularNameData } from "../ucd/parser.ts";
import { connectSync } from "./conn.ts";
import { CustomDisposable } from "../raii.ts";

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
  let lastRangeStart: { name: RangeIdentifierStartData, codepoint: number } | null = null;
  for await (const line of lines(unicodeData.readable)) {
    const dataElems = parseRow(line);
    if (dataElems == null) {
      continue;
    }
    if (dataElems.length < 2) {
      throw new SyntaxError(`Invalid row: ${line}`);
    }
    const [codepointText, nameText] = dataElems;
    const endCodepoint = parseCodePoint(codepointText);
    let startCodepoint = endCodepoint;
    const nameDataInput = parseName(nameText);
    let nameData: RegularNameData | DerivableNameData;
    if (lastRangeStart != null) {
      if (nameDataInput.type !== "RangeIdentifierEnd" || nameDataInput.identifier !== lastRangeStart.name.identifier) {
        throw new SyntaxError(`Expected range end of the same name as ${lastRangeStart.name.identifier}, got: ${nameText}`);
      }
      startCodepoint = lastRangeStart.codepoint;
      lastRangeStart = null;
      nameData = DerivableNameData(nameDataInput.identifier);
    } else if (nameDataInput.type === "RangeIdentifierStart") {
      lastRangeStart = { name: nameDataInput, codepoint: startCodepoint };
      continue;
    } else if (nameDataInput.type === "RangeIdentifierEnd") {
      throw new SyntaxError(`Unexpected range end: ${nameText}`);
    } else {
      nameData = nameDataInput;
    }
    for (let codepoint = startCodepoint; codepoint <= endCodepoint; codepoint++) {
      const name = nameData.type === "DerivableName" ? deriveName(nameData.label, codepoint) : nameData.name;
      bulkRows.push({
        codepoint,
        name,
        flags: 0,
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
