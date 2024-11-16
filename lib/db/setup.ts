import { lines } from "../lines.ts";
import { downloadUCD } from "../ucd/download.ts";
import { deriveName } from "../ucd/name.ts";
import { parseUnicodeData } from "../ucd/parser.ts";
import { DB_PATH } from "./path.ts";
import { sqlite } from "./pool.ts";
import { compressFlags, expandFlags } from "../flags.ts";
import { AsyncConnection } from "../sqlite.ts";
import { allTags, codepointTags } from "../tag.ts";

export async function setup() {
  await using db = await sqlite.open(DB_PATH, { write: true, create: true });
  await db.execute(`
    DROP INDEX IF EXISTS codepoint_taggings_by_tag;
    DROP TABLE IF EXISTS codepoint_taggings;
    DROP TABLE IF EXISTS tags;
    DROP INDEX IF EXISTS codepoints_name;
    DROP TABLE IF EXISTS codepoints;

    CREATE TABLE codepoints (
      codepoint INTEGER PRIMARY KEY,
      name      TEXT,
      flags1    INTEGER
    );

    CREATE INDEX codepoints_name ON codepoints (name);

    CREATE TABLE tags (
      tag_id   INTEGER PRIMARY KEY,
      tag_name TEXT UNIQUE
    );

    CREATE TABLE codepoint_taggings (
      codepoint INTEGER,
      tag_id    INTEGER,
      PRIMARY KEY (codepoint, tag_id)
    );

    CREATE INDEX codepoint_taggings_by_tag_id ON codepoint_taggings (tag_id, codepoint);
  `);

  await setupUnicodeData(db);
  const tagIds = await setupTags(db);
  await setupCodepointTags(db, tagIds);
}

async function setupUnicodeData(db: AsyncConnection) {
  const unicodeDataPath = await downloadUCD("UnicodeData.txt");

  type InsertCodepointParams = {
    codepoint: number;
    name: string;
    flags1: number;
  };
  await using insertCodepoint = await db.prepare<{
    codepoint: number;
    name: string;
    flags1: number;
  }>(`
    INSERT INTO codepoints (codepoint, name, flags1)
    VALUES (:codepoint, :name, :flags1);
  `);
  let insertedCodepointCount = 0;
  const bulkInsertCodepoint = new AsyncFlusher<InsertCodepointParams>(async (rows) => {
    await db.transaction(async () => {
      for (const row of rows) {
        await insertCodepoint.execute(row);
      }
    });
    insertedCodepointCount += rows.length;
    console.log(`Inserted ${insertedCodepointCount} codepoints`);
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
  let insertedCodepointTagCount = 0;
  const bulkInsertTag = new AsyncFlusher<InsertTagParams>(async (rows) => {
    await db.transaction(async () => {
      for (const row of rows) {
        const rows = await insertTag.executeRows(row);
        tagIds[rows[0].tag_name] = rows[0].tag_id;
      }
    });
    insertedCodepointTagCount += rows.length;
    console.log(`Inserted ${insertedCodepointTagCount} tags`);
  }, 1000);
  for (const tag of allTags()) {
    await bulkInsertTag.push({ tag_name: tag });
  }
  await bulkInsertTag.flush();
  return tagIds;
}

async function setupCodepointTags(db: AsyncConnection, tagIds: Record<string, number>) {
  await using getCodepointsInBatch = await db.prepare<{
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
    SELECT codepoint, name, flags1 FROM codepoints
    WHERE codepoint > :after
    ORDER BY codepoint
    LIMIT 1000;
  `);
  type InsertCodepointTaggingParams = {
    codepoint: number;
    tag_id: number;
  };
  await using insertCodepointTagging = await db.prepare<{
    codepoint: number;
    tag_id: number;
  }>(`
    INSERT INTO codepoint_taggings (codepoint, tag_id)
    VALUES (:codepoint, :tag_id);
  `);
  let insertedCodepointTaggingCount = 0;
  const bulkInsertCodepointTagging = new AsyncFlusher<InsertCodepointTaggingParams>(async (rows) => {
    await db.transaction(async () => {
      for (const row of rows) {
        await insertCodepointTagging.execute(row);
      }
    });
    insertedCodepointTaggingCount += rows.length;
    console.log(`Inserted ${insertedCodepointTaggingCount} codepoint taggings`);
  }, 1000);
  let after = -1;
  while (true) {
    const codepoints = await getCodepointsInBatch.executeRows({ after });
    if (codepoints.length === 0) {
      break;
    }
    for (const codepointData of codepoints) {
      const tags = codepointTags(expandFlags(codepointData));
      for (const tag of tags) {
        if (!Object.hasOwn(tagIds, tag)) {
          throw new Error(`Tag ${tag} not found in tagIds`);
        }
        await bulkInsertCodepointTagging.push({ codepoint: codepointData.codepoint, tag_id: tagIds[tag] });
      }
    }
    after = codepoints[codepoints.length - 1].codepoint;
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
