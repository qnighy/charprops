// @deno-types="npm:wa-sqlite"
import SQLiteESMFactory from 'wa-sqlite/dist/wa-sqlite-async.mjs';
import { AsyncDenoVFS } from "./async-deno-vfs.ts";
// @deno-types="npm:wa-sqlite"
import * as SQLite from 'wa-sqlite';

const module = await SQLiteESMFactory();
const sqlite3 = SQLite.Factory(module);
sqlite3.vfs_register(new AsyncDenoVFS(), true);

export { sqlite3 as AsyncSQLite }
