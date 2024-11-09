import * as path from "$std/path/mod.ts";
import { DB } from "sqlite";

const moduleDir = import.meta.dirname;
if (moduleDir == null) {
  throw new Error(`Not a local module: ${import.meta.url}`);
}

export const db = new DB(path.join(moduleDir, "../../db.sqlite3"));
