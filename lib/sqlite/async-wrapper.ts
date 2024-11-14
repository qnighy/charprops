// @deno-types="npm:wa-sqlite"
import * as SQLite from 'wa-sqlite';
import { SQLiteParam, SQLiteParams, SQLiteRow, SQLiteRowPositional, SQLiteString } from "./common-wrapper.ts";

export class AsyncSQLiteWrapper {
  #api: SQLiteAPI;
  
  constructor(api: SQLiteAPI) {
    this.#api = api;
  }

  async open(filename: string, options: OpenOptions = {}): Promise<AsyncConnection> {
    const pointer = await this.#api.open_v2(filename, AsyncSQLiteWrapper.#openFlags(options), options.vfs);
    return new AsyncConnection(this.#api, pointer);
  }

  static #openFlags(options: OpenOptions): number {
    const {
      write = true,
      create = true,
      uri = false,
      memory = false,
      noMutex = false,
      fullMutex = false,
      sharedCache,
      exResCode = false,
      noFollow = false
    } = options;
    let flags = 0;
    if (write) {
      flags |= SQLite.SQLITE_OPEN_READWRITE;
      if (create) {
        flags |= SQLite.SQLITE_OPEN_CREATE;
      }
    } else {
      flags |= SQLite.SQLITE_OPEN_READONLY;
    }
    if (uri) {
      flags |= SQLite.SQLITE_OPEN_URI;
    }
    if (memory) {
      flags |= SQLite.SQLITE_OPEN_MEMORY;
    }
    if (noMutex) {
      flags |= SQLite.SQLITE_OPEN_NOMUTEX;
    } else if (fullMutex) {
      flags |= SQLite.SQLITE_OPEN_FULLMUTEX;
    }
    if (sharedCache) {
      flags |= SQLite.SQLITE_OPEN_SHAREDCACHE;
    } else if (sharedCache === false) {
      flags |= SQLite.SQLITE_OPEN_PRIVATECACHE;
    }
    if (exResCode) {
      flags |= SQLite.SQLITE_OPEN_EXCLUSIVE;
    }
    if (noFollow) {
      flags |= SQLite.SQLITE_OPEN_NOFOLLOW;
    }
    return flags;
  }
}

export type OpenOptions = {
  /**
   * @default true
   */
  write?: boolean;
  /**
   * @default true
   */
  create?: boolean;
  /**
   * @default false
   */
  uri?: boolean;
  /**
   * @default false
   */
  memory?: boolean;
  /**
   * @default false
   */
  noMutex?: boolean;
  /**
   * @default false
   */
  fullMutex?: boolean;
  sharedCache?: boolean | undefined;
  /**
   * @default false
   */
  exResCode?: boolean;
  /**
   * @default false
   */
  noFollow?: boolean;
  vfs?: string;
};

export class AsyncConnection implements AsyncDisposable {
  #api: SQLiteAPI;
  #dbPointer: number;
  #transactions: [AsyncTransaction, { name?: string }][] = [];
  #currentSavepointId = 1;

  constructor(api: SQLiteAPI, dbId: number) {
    this.#api = api;
    this.#dbPointer = dbId;
  }

  async [Symbol.asyncDispose]() {
    await this.#api.close(this.#dbPointer);
  }

  async *prepareIter(sql: string): AsyncIterableIterator<AsyncStatement> {
    using sqlPointer = new SQLiteString(sql, this.#api);
    let currentSQL = sqlPointer.pointer;
    while (true) {
      const result = await this.#api.prepare_v2(this.#dbPointer, currentSQL);
      if (!result) {
        break;
      }
      yield new AsyncStatement(this.#api, result.stmt);
      currentSQL = result.sql;
    }
  }

  async prepareAll(sql: string): Promise<AsyncDisposableArray<AsyncStatement>> {
    const stmts = new AsyncDisposableArray<AsyncStatement>();
    for await (const stmt of this.prepareIter(sql)) {
      stmts.push(stmt);
    }
    return stmts;
  }

  async prepare(sql: string): Promise<AsyncStatement> {
    let firstStmt: AsyncStatement | undefined = undefined;
    for await (const stmt of this.prepareIter(sql)) {
      if (firstStmt) {
        await firstStmt[Symbol.asyncDispose]();
        await stmt[Symbol.asyncDispose]();
        throw new Error('Multiple statements found in SQL');
      }
      firstStmt = stmt;
    }
    if (!firstStmt) {
      throw new Error('No statements found in SQL');
    }
    return firstStmt;
  }

  async *executeIterPositional(sql: string, params?: SQLiteParams): AsyncIterableIterator<SQLiteRowPositional> {
    for await (const stmt_ of this.prepareIter(sql)) {
      // Workaround for await using in for-of loop, whose implementation in current Deno is broken
      await using stmt = stmt_;
      yield* stmt.executeIterPositional(params);
    }
  }

  async *executeIter(sql: string, params?: SQLiteParams): AsyncIterableIterator<SQLiteRow> {
    for await (const stmt_ of this.prepareIter(sql)) {
      // Workaround for await using in for-of loop, whose implementation in current Deno is broken
      await using stmt = stmt_;
      yield* stmt.executeIter(params);
    }
  }

  async executeRowsPositional(sql: string, params?: SQLiteParams): Promise<SQLiteRowPositional[]> {
    const rows: SQLiteRowPositional[] = [];
    for await (const row of this.executeIterPositional(sql, params)) {
      rows.push(row);
    }
    return rows;
  }

  async executeRows(sql: string, params?: SQLiteParams): Promise<SQLiteRow[]> {
    const rows: SQLiteRow[] = [];
    for await (const row of this.executeIter(sql, params)) {
      rows.push(row);
    }
    return rows;
  }

  async execute(sql: string, params?: SQLiteParams): Promise<void> {
    for await (const stmt_ of this.prepareIter(sql)) {
      // Workaround for await using in for-of loop, whose implementation in current Deno is broken
      await using stmt = stmt_;
      await stmt.execute(params);
    }
  }

  async begin(): Promise<AsyncTransaction> {
    if (this.#transactions.length > 0) {
      const savepointName = `savepoint_${this.#currentSavepointId++}`;
      await this.execute(`SAVEPOINT ${savepointName};`);
      const transaction = new AsyncTransaction(this);
      this.#transactions.push([transaction, { name: savepointName }]);
      return transaction;
    } else {
      await this.execute("BEGIN;");
      const transaction = new AsyncTransaction(this);
      this.#transactions.push([transaction, {}]);
      return transaction;
    }
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    let gotError = false;
    const transaction = await this.begin();
    try {
      return await callback();
    } catch (e) {
      gotError = true;
      throw e;
    } finally {
      if (gotError) {
        await transaction.rollback();
      } else {
        await transaction.commit();
      }
    }
  }

  async _commitOrRollbackTransaction(transaction: AsyncTransaction, rollback: boolean): Promise<void> {
    const index = this.#transactions.findLastIndex(([t]) => t === transaction);
    if (index === -1) {
      return;
    }
    while (this.#transactions.length > index) {
      const current = this.#transactions.pop();
      if (current) {
        if (current[0] === transaction && rollback) {
          if (current[1].name) {
            await this.execute(`ROLLBACK TO ${current[1].name};`);
          } else {
            await this.execute("ROLLBACK;");
          }
        } else {
          if (current[1].name) {
            await this.execute(`RELEASE ${current[1].name};`);
          } else {
            await this.execute("COMMIT;");
          }
        }
      }
    }
  }
}

export class AsyncTransaction implements AsyncDisposable {
  #connection: AsyncConnection;

  constructor(connection: AsyncConnection) {
    this.#connection = connection;
  }

  async commit(): Promise<void> {
    await this.#connection._commitOrRollbackTransaction(this, false);
  }

  async rollback(): Promise<void> {
    await this.#connection._commitOrRollbackTransaction(this, true);
  }

  async [Symbol.asyncDispose]() {
    await this.#connection._commitOrRollbackTransaction(this, false);
  }
}

export class AsyncStatement implements AsyncDisposable {
  #api: SQLiteAPI;
  #pointer: number;

  constructor(api: SQLiteAPI, pointer: number) {
    this.#api = api;
    this.#pointer = pointer;
  }

  async [Symbol.asyncDispose]() {
    await this.#api.finalize(this.#pointer);
  }

  get columnCount(): number {
    return this.#api.column_count(this.#pointer);
  }

  columnName(index: number): string {
    return this.#api.column_name(this.#pointer, index);
  }

  get columnNames(): string[] {
    return Array.from({ length: this.columnCount }, (_, i) => this.columnName(i));
  }

  async reset(): Promise<void> {
    await this.#api.reset(this.#pointer);
  }

  async *executeIterPositional(params?: SQLiteParams): AsyncIterableIterator<SQLiteRowPositional> {
    try {
      if (params) {
        this.bindParameters(params);
      }
      while (true) {
        const result = await this.#api.step(this.#pointer);
        if (result === SQLite.SQLITE_DONE) {
          break;
        }
        if (result !== SQLite.SQLITE_ROW) {
          throw new Error(`Unexpected result: ${result}`);
        }
        // TODO: use a low-level API
        const row = this.#api.row(this.#pointer);
        yield row;
      }
    } finally {
      await this.reset();
    }
  }

  async *executeIter(params?: SQLiteParams): AsyncIterableIterator<SQLiteRow> {
    const columnNames = this.columnNames;
    for await (const row of this.executeIterPositional(params)) {
      yield Object.fromEntries(columnNames.map((name, i) => [name, row[i]]));
    }
  }

  async executeRowsPositional(params?: SQLiteParams): Promise<SQLiteRowPositional[]> {
    const rows: SQLiteRowPositional[] = [];
    for await (const row of this.executeIterPositional(params)) {
      rows.push(row);
    }
    return rows;
  }

  async executeRows(params?: SQLiteParams): Promise<SQLiteRow[]> {
    const rows: SQLiteRow[] = [];
    for await (const row of this.executeIter(params)) {
      rows.push(row);
    }
    return rows;
  }

  async execute(params?: SQLiteParams): Promise<void> {
    for await (const _ of this.executeIterPositional(params)) {
      // consume the iterator
    }
  }

  async step(): Promise<{ hasRow: boolean }> {
    const result = await this.#api.step(this.#pointer);
    return { hasRow: result === SQLite.SQLITE_ROW };
  }

  get bindParameterCount(): number {
    return this.#api.bind_parameter_count(this.#pointer);
  }

  bindParameterName(index: number): string {
    return this.#api.bind_parameter_name(this.#pointer, index + 1);
  }

  get bindParameterNames(): string[] {
    return Array.from({ length: this.bindParameterCount }, (_, i) => this.bindParameterName(i));
  }

  // get bindParameterIndex(name: string): number | undefined {
  //   const index = this.#api.bind_parameter_index(this.#pointer, name);
  //   return index >= 1 ? index - 1 : undefined;
  // }

  bindParameter(index: number, value: SQLiteParam): void {
    switch (typeof value) {
      case "number":
        if (value === (value | 0)) {
          this.#api.bind_int(this.#pointer, index + 1, value);
        } else {
          this.#api.bind_double(this.#pointer, index + 1, value);
        }
        break;
      case "bigint":
        this.#api.bind_int64(this.#pointer, index + 1, value);
        break;
      case "boolean":
        this.#api.bind_int(this.#pointer, index + 1, Number(value));
        break;
      case "string":
        this.#api.bind_text(this.#pointer, index + 1, value);
        break;
      case "undefined":
        this.#api.bind_null(this.#pointer, index + 1);
        break;
      case "object":
      case "function":
        if (value === null) {
          this.#api.bind_null(this.#pointer, index + 1);
        } else if (value instanceof Uint8Array) {
          this.#api.bind_blob(this.#pointer, index + 1, value);
        } else {
          throw new Error(`Unsupported parameter type: ${(value as object).constructor?.name ?? "unknown"}`);
        }
        break;
      default:
        throw new Error(`Unsupported parameter type: ${typeof value}`);
    }
  }

  bindParameters(params: SQLiteParams): void {
    const count = this.bindParameterCount;
    let currentAnonymousIndex = 0;
    for (let i = 0; i < count; i++) {
      const name = this.bindParameterName(i);
      const key = name ? name.replace(/^[:@$]/, "") : `${currentAnonymousIndex++}`;
      if (!Object.hasOwn(params, key)) {
        throw new Error(`Missing parameter ${key}`);
      }
      const value = (params as Record<string | number, SQLiteParam>)[key];
      this.bindParameter(i, value);
    }
  }
}

export class AsyncDisposableArray<T extends AsyncDisposable | null | undefined> extends Array<T> implements AsyncDisposable {
  async [Symbol.asyncDispose]() {
    let error: unknown = undefined;
    let hasError = false;
    while (this.length > 0) {
      const item = this.pop();
      if (item) {
        try {
          await item[Symbol.asyncDispose]();
        } catch (e) {
          error = hasError ? new SuppressedError(e, error) : e;
          hasError = true;
        }
      }
    }
    if (hasError) {
      throw error;
    }
  }
}
