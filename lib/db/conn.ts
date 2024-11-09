import { DB } from "sqlite";
import { DB_PATH } from "./path.ts";

const moduleDir = import.meta.dirname;
if (moduleDir == null) {
  throw new Error(`Not a local module: ${import.meta.url}`);
}

export function connectSync(): DB {
  return new DB(DB_PATH);
}
