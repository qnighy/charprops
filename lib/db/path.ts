import * as path from "$std/path/mod.ts";

const moduleDir = import.meta.dirname;
if (moduleDir == null) {
  throw new Error(`Not a local module: ${import.meta.url}`);
}

export const DB_PATH = path.join(moduleDir, "../../db.sqlite3");
