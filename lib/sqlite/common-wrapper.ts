// @deno-types="npm:wa-sqlite"
import type {} from 'wa-sqlite';

export class SQLiteString implements Disposable {
  #api: SQLiteAPI;
  #id: number;
  constructor(s: string, api: SQLiteAPI) {
    this.#api = api;
    // DB param is unused
    this.#id = api.str_new(-1, s);
  }

  get pointer(): number {
    return this.#api.str_value(this.#id);
  }

  append(s: string): void {
    this.#api.str_appendall(this.#id, s);
  }

  [Symbol.dispose]() {
    this.#api.str_finish(this.#id);
  }
}

export type SQLiteParam = number | bigint | boolean | string | Uint8Array | null;
export type SQLiteParams = Record<string | number, SQLiteParam> | SQLiteParam[];
export type SQLiteCellValue = SQLiteCompatibleType;
export type SQLiteRowPositional = SQLiteCellValue[];
export type SQLiteRow = Record<string, SQLiteCellValue>;
