import { lines } from "../lines.ts";
import { downloadUCD } from "../ucd/download.ts";
import { deriveName } from "../ucd/name.ts";
import { parseUnicodeData } from "../ucd/parser.ts";
import { DB_PATH } from "./path.ts";
import { sqlite } from "./pool.ts";
import { compressFlags, expandFlags } from "../flags.ts";
import { AsyncConnection } from "../sqlite.ts";
import { allTags, charTags } from "../tag.ts";

export async function setup() {
  await using db = await sqlite.open(DB_PATH, { write: true, create: true });
  await db.execute(`
    DROP INDEX IF EXISTS char_taggings_by_tag;
    DROP TABLE IF EXISTS char_taggings;
    DROP TABLE IF EXISTS tags;
    DROP INDEX IF EXISTS chars_name;
    DROP TABLE IF EXISTS chars;

    CREATE TABLE chars (
      codepoint INTEGER PRIMARY KEY,
      name      TEXT,
      flags1    INTEGER
    );

    CREATE INDEX chars_name ON chars (name);

    CREATE TABLE tags (
      tag_id   INTEGER PRIMARY KEY,
      tag_name TEXT UNIQUE
    );

    CREATE TABLE char_taggings (
      codepoint INTEGER,
      tag_id    INTEGER,
      PRIMARY KEY (codepoint, tag_id)
    );

    CREATE INDEX char_taggings_by_tag_id ON char_taggings (tag_id, codepoint);
  `);

  await setupUnicodeData(db);
  const tagIds = await setupTags(db);
  await setupCharTags(db, tagIds);
}

async function setupUnicodeData(db: AsyncConnection) {
  const unicodeDataPath = await downloadUCD("UnicodeData.txt");

  type InsertCharParams = {
    codepoint: number;
    name: string;
    flags1: number;
  };
  await using insertChar = await db.prepare<{
    codepoint: number;
    name: string;
    flags1: number;
  }>(`
    INSERT INTO chars (codepoint, name, flags1)
    VALUES (:codepoint, :name, :flags1);
  `);
  let insertedCharCount = 0;
  const bulkInsertChar = new AsyncFlusher<InsertCharParams>(async (rows) => {
    await db.transaction(async () => {
      for (const row of rows) {
        await insertChar.execute(row);
      }
    });
    insertedCharCount += rows.length;
    console.log(`Inserted ${insertedCharCount} chars`);
  }, 1000);
  const unicodeData = await Deno.open(unicodeDataPath);
  for await (const row of parseUnicodeData(lines(unicodeData.readable))) {
    const { codepoint: codepointOrRange, name: nameData } = row;
    const startCodepoint = codepointOrRange.type === "CodepointRange" ? codepointOrRange.start : codepointOrRange.codepoint;
    const endCodepoint = codepointOrRange.type === "CodepointRange" ? codepointOrRange.end : startCodepoint;
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
      await bulkInsertChar.push(compressed);
    }
  }
  await bulkInsertChar.flush();
}

async function setupTags(db: AsyncConnection): Promise<Record<string, number>> {
  type InsertTagParams = {
    tag_name: string;
  };
  await using insertTag = await db.prepare<{
    tag_name: string;
  }, {
    tag_id: number;
    tag_name: string;
  }, [
    tag_id: number,
    tag_name: string
  ]>(`
    INSERT INTO tags (tag_name)
    VALUES (:tag_name)
    RETURNING tag_id, tag_name;
  `);
  const tagIds: Record<string, number> = {};
  let insertedCharTagCount = 0;
  const bulkInsertTag = new AsyncFlusher<InsertTagParams>(async (rows) => {
    await db.transaction(async () => {
      for (const row of rows) {
        const rows = await insertTag.executeRows(row);
        tagIds[rows[0].tag_name] = rows[0].tag_id;
      }
    });
    insertedCharTagCount += rows.length;
    console.log(`Inserted ${insertedCharTagCount} tags`);
  }, 1000);
  for (const tag of allTags()) {
    await bulkInsertTag.push({ tag_name: tag });
  }
  await bulkInsertTag.flush();
  return tagIds;
}

async function setupCharTags(db: AsyncConnection, tagIds: Record<string, number>) {
  await using getCharsInBatch = await db.prepare<{
    after: number;
  }, {
    codepoint: number;
    name: string;
    flags1: number;
  }, [
    codepoint: number,
    name: string,
    flags1: number
  ]>(`
    SELECT codepoint, name, flags1 FROM chars
    WHERE codepoint > :after
    ORDER BY codepoint
    LIMIT 1000;
  `);
  type InsertCharTaggingParams = {
    codepoint: number;
    tag_id: number;
  };
  await using insertCharTagging = await db.prepare<{
    codepoint: number;
    tag_id: number;
  }>(`
    INSERT INTO char_taggings (codepoint, tag_id)
    VALUES (:codepoint, :tag_id);
  `);
  let insertedCharTaggingCount = 0;
  const bulkInsertCharTagging = new AsyncFlusher<InsertCharTaggingParams>(async (rows) => {
    await db.transaction(async () => {
      for (const row of rows) {
        await insertCharTagging.execute(row);
      }
    });
    insertedCharTaggingCount += rows.length;
    console.log(`Inserted ${insertedCharTaggingCount} char taggings`);
  }, 1000);
  let after = -1;
  while (true) {
    const charDataArray = await getCharsInBatch.executeRows({ after });
    if (charDataArray.length === 0) {
      break;
    }
    for (const charData of charDataArray) {
      const tags = charTags(expandFlags(charData));
      for (const tag of tags) {
        if (!Object.hasOwn(tagIds, tag)) {
          throw new Error(`Tag ${tag} not found in tagIds`);
        }
        await bulkInsertCharTagging.push({ codepoint: charData.codepoint, tag_id: tagIds[tag] });
      }
    }
    after = charDataArray[charDataArray.length - 1].codepoint;
  }
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
