import { lines } from "../lines.ts";
import { downloadUCD } from "../ucd/download.ts";
import { deriveName } from "../ucd/name.ts";
import { parseUnicodeData } from "../ucd/parser.ts";
import { DB_PATH } from "./path.ts";
import { sqlite } from "./pool.ts";
import { compressFlags } from "../flags.ts";

export async function setup() {
  await using db = await sqlite.open(DB_PATH, { write: true, create: true });
  await db.execute(`
    DROP INDEX IF EXISTS codepoint_taggings_by_tag;
    DROP TABLE IF EXISTS codepoint_taggings;
    DROP INDEX IF EXISTS codepoints_name;
    DROP TABLE IF EXISTS codepoints;

    CREATE TABLE codepoints (
      codepoint INTEGER PRIMARY KEY,
      name      TEXT,
      flags1    INTEGER
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

  const unicodeDataPath = await downloadUCD("UnicodeData.txt");

  type InsertCodepointParams = {
    codepoint: number;
    name: string;
    flags1: number;
  };
  await using insertCodepoint = await db.prepare(`
    INSERT INTO codepoints (codepoint, name, flags1)
    VALUES (:codepoint, :name, :flags1);
  `);
  const bulkInsertCodepoint = new AsyncFlusher<InsertCodepointParams>(async (rows) => {
    await db.transaction(async () => {
      for (const row of rows) {
        await insertCodepoint.execute(row);
      }
    });
    console.log(`Inserted ${rows.length} codepoints`);
  }, 1000);
  const unicodeData = await Deno.open(unicodeDataPath);
  for await (const row of parseUnicodeData(lines(unicodeData.readable))) {
    const { codepoint: codepointOrRange, name: nameData } = row;
    const startCodepoint = codepointOrRange.type === "CodePointRange" ? codepointOrRange.start : codepointOrRange.codepoint;
    const endCodepoint = codepointOrRange.type === "CodePointRange" ? codepointOrRange.end : startCodepoint;
    for (let codepoint = startCodepoint; codepoint <= endCodepoint; codepoint++) {
      const name = nameData.type === "DerivableName" ? deriveName(nameData.label, codepoint) : nameData.name;
      const compressed = compressFlags({
        codepoint,
        name,
        generalCategory: row.generalCategory,
        canonicalCombiningClass: row.canonicalCombiningClass,
        bidiClass: row.bidiClass,
        decompositionType: row.decomposition?.decompositionType,
        numericType: row.numeric?.numericType,
        bidiMirrored: row.bidiMirrored,
      });
      await bulkInsertCodepoint.push(compressed);
    }
  }
  await bulkInsertCodepoint.flush();
}

class AsyncFlusher<T> {
  #handler: (rows: T[]) => Promise<void>;
  #entries: T[] = [];
  #threshold: number;

  constructor(handler: (rows: T[]) => Promise<void>, threshold: number) {
    this.#handler = handler;
    this.#threshold = threshold;
  }

  async push(...entries: T[]) {
    this.#entries.push(...entries);
    if (this.#entries.length >= this.#threshold) {
      await this.flush();
    }
  }

  async flush() {
    await this.#handler(this.#entries.splice(0));
  }
}

if (import.meta.main) {
  await setup();
}
