import { DB } from "sqlite";

const db = new DB("ucd/ucd.db");
db.execute(`
  CREATE TABLE IF NOT EXISTS codepoints (
    codepoint INTEGER PRIMARY KEY,
    name      TEXT,
    flags     INTEGER
  );

  CREATE INDEX IF NOT EXISTS codepoints_name ON codepoints (name);

  CREATE TABLE IF NOT EXISTS codepoint_taggings (
    codepoint INTEGER,
    tag_id    INTEGER,
    tag_value INTEGER,
    PRIMARY KEY (codepoint, tag_id)
  );

  CREATE INDEX IF NOT EXISTS codepoint_taggings_by_tag ON codepoint_taggings (tag_id, tag_value);
`);
