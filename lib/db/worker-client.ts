import type { ColumnName, QueryParameterSet, Row, RowObject, SqliteDeserializeOptions, SqliteOptions } from "sqlite";
import { CloseRequest, ConnectRequest, IteratorNextRequest, IteratorNextWithValueRequest, IteratorProfile, PrepareQueryRequest, QueryRequest, WorkerRequest, WorkerResponse, WorkerReturnValues, PreparedQueryIterRequest, PreparedQueryIterEntriesRequest, IteratorReturnWithValueRequest, IteratorReturnRequest, IteratorThrowRequest, QueryEntriesRequest, PreparedQueryAllRequest, PreparedQueryAllEntriesRequest, PreparedQueryFirstRequest, PreparedQueryFirstEntryRequest, PreparedQueryOneRequest, PreparedQueryOneEntryRequest, PreparedQueryExecuteRequest, PreparedQueryFinalizeRequest, PreparedQueryColumnsRequest, PreparedQueryExpandSqlRequest, ExecuteRequest, SerializeRequest, DeserializeRequest } from "./worker-protocol.ts";

const enableWorkerPermissions = false;

type WorkerClientOptions = {
  readPermissions: URL[];
  writePermissions: URL[];
};

const AsyncIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(async function* () {}).prototype);

class WorkerClient {
  #worker: Worker;
  #currentId = 1;
  #callbacks = new Map<number, (resp: WorkerResponse) => void>();
  queryId = 1;
  iterId = 1;

  constructor(options: WorkerClientOptions) {
    const workerOptions: WorkerOptions = { type: "module" };
    if (enableWorkerPermissions) {
      (workerOptions as { deno: unknown }).deno = {
        permissions: {
          read: options.readPermissions,
          write: options.writePermissions,
        },
      };
    }
    this.#worker = new Worker(new URL("./worker.ts", import.meta.url).href, workerOptions);
    this.#worker.onmessage = (ev) => {
      const resp = ev.data as WorkerResponse;
      const cb = this.#callbacks.get(resp.id);
      if (cb) {
        this.#callbacks.delete(resp.id);
        cb(resp);
      }
    };
  }

  call<Req extends WorkerRequest>(req: Req): Promise<WorkerReturnValues[Req["type"]]> {
    req.id = this.#currentId++;
    return new Promise((resolve, reject) => {
      this.#callbacks.set(req.id, (resp) => {
        if (resp.type === "error") {
          reject(new Error(resp.message));
        } else {
          resolve(resp.value as WorkerReturnValues[Req["type"]]);
        }
      });
      this.#worker.postMessage(req);
    });
  }

  close(): void {
    this.#worker.terminate();
  }

  // deno-lint-ignore no-explicit-any
  createIterator<T, TReturn = any, TNext = any>(iterId: number, profile: IteratorProfile): AsyncIterableIterator<T, TReturn, TNext> {
    // deno-lint-ignore no-this-alias
    const client = this;
    const iter: AsyncIterableIterator<T, TReturn, TNext> = Object.assign(Object.create(AsyncIteratorPrototype), {
      async next(value?: unknown): Promise<IteratorResult<T, TReturn>> {
        if (arguments.length > 0) {
          return (await client.call(IteratorNextWithValueRequest(iterId, value))) as IteratorResult<T, TReturn>;
        } else {
          return (await client.call(IteratorNextRequest(iterId))) as IteratorResult<T, TReturn>;
        }
      },
      async return(value?: TReturn | PromiseLike<TReturn>): Promise<IteratorResult<T, TReturn>> {
        if (arguments.length > 0) {
          const resolvedValue = await value;
          return (await client.call(IteratorReturnWithValueRequest(iterId, resolvedValue))) as IteratorResult<T, TReturn>;
        } else {
          return (await client.call(IteratorReturnRequest(iterId))) as IteratorResult<T, TReturn>;
        }
      },
      // deno-lint-ignore no-explicit-any
      async throw(error?: any): Promise<IteratorResult<T, TReturn>> {
        return (await client.call(IteratorThrowRequest(iterId, error))) as IteratorResult<T, TReturn>;
      },
    } satisfies Omit<AsyncIterableIterator<T, TReturn, TNext>, typeof Symbol.asyncIterator>);
    if (!profile.hasReturn) {
      delete iter.return;
    }
    if (!profile.hasThrow) {
      delete iter.throw;
    }
    return iter;
  }
}

export class DB {
  static #privateConstructorKey: unknown = {};
  #client: WorkerClient;
  #queryId = 1;
  #transactionDepth = 0;

  /**
   * Essentially private. Use {@link DB.connect} instead.
   */
  constructor(client: unknown, privateConstructorKey: unknown) {
    if (privateConstructorKey !== DB.#privateConstructorKey) {
      throw new Error("Use DB.connect() to create a new connection asynchronously");
    }
    this.#client = client as WorkerClient;
  }

  static async connect(path = ":memory:", options: SqliteOptions = {}): Promise<DB> {
    const { mode = "create", memory = false, uri = false } = options;
    const readPermissions: URL[] = [];
    const writePermissions: URL[] = [];
    if (!memory && (uri || path !== ":memory:")) {
      // TODO: better relative path base?
      const url = new URL(path, import.meta.url);
      readPermissions.push(url);
      if (mode !== "read") {
        writePermissions.push(url);
      }
    }
    const client = new WorkerClient({
      readPermissions,
      writePermissions,
    });
    try {
      await client.call(ConnectRequest(path, {
        mode,
        memory,
        uri,
      }));
    } catch (e) {
      try {
        await client.call(CloseRequest(true));
      } finally {
        client.close();
      }
      throw e;
    }
    return new DB(client, DB.#privateConstructorKey);
  }

  async query<R extends Row = Row>(
    sql: string,
    params: QueryParameterSet = {},
  ): Promise<R[]> {
    return (await this.#client.call(QueryRequest(sql, params))) as R[];
  }

  async queryEntries<O extends RowObject = RowObject>(
    sql: string,
    params: QueryParameterSet = {},
  ): Promise<O[]> {
    return (await this.#client.call(QueryEntriesRequest(sql, params))) as O[];
  }

  async prepareQuery<
    R extends Row = Row,
    O extends RowObject = RowObject,
    P extends QueryParameterSet = QueryParameterSet,
  >(
    sql: string,
  ): Promise<PreparedQuery<R, O, P>> {
    const queryId = this.#queryId++;
    await this.#client.call(PrepareQueryRequest(sql, queryId));
    return new PreparedQuery(this.#client, queryId, preparedQueryConstructorKey);
  }

  async execute(sql: string): Promise<void> {
    await this.#client.call(ExecuteRequest(sql));
  }

  async transaction<V>(closure: () => Promise<V>): Promise<V> {
    this.#transactionDepth += 1;
    this.execute(`SAVEPOINT _deno_sqlite_async_sp_${this.#transactionDepth}`);
    try {
      return await closure();
    } catch (err) {
      this.execute(`ROLLBACK TO _deno_sqlite_async_sp_${this.#transactionDepth}`);
      throw err;
    } finally {
      this.execute(`RELEASE _deno_sqlite_async_sp_${this.#transactionDepth}`);
      this.#transactionDepth -= 1;
    }
  }

  async serialize(schema: "main" | "temp" | string = "main"): Promise<Uint8Array> {
    return await this.#client.call(SerializeRequest(schema));
  }

  async deserialize(data: Uint8Array, options: SqliteDeserializeOptions = {}): Promise<void> {
    await this.#client.call(DeserializeRequest(data, options));
  }

  async close(force = false): Promise<void> {
    try {
      await this.#client.call(CloseRequest(force));
    } finally {
      this.#client.close();
    }
  }
}

const preparedQueryConstructorKey: unknown = {};

export class PreparedQuery<
  R extends Row = Row,
  O extends RowObject = RowObject,
  P extends QueryParameterSet = QueryParameterSet,
> {
  #client: WorkerClient;
  #queryId: number;
  /**
   * Essentially private, do not call this outside of the library.
   */
  constructor(client: unknown, queryId: number, privateConstructorKey: unknown) {
    if (privateConstructorKey !== preparedQueryConstructorKey) {
      throw new Error("Use DB.prototype.prepareQuery() to create a new prepared query");
    }
    this.#client = client as WorkerClient;
    this.#queryId = queryId;
  }

  async iter(params?: P): Promise<AsyncIterableIterator<R>> {
    const iterId = this.#client.iterId++;
    const profile = await this.#client.call(PreparedQueryIterRequest(this.#queryId, params, iterId));
    return this.#client.createIterator<R>(iterId, profile);
  }

  async iterEntries(params?: P): Promise<AsyncIterableIterator<O>> {
    const iterId = this.#client.iterId++;
    const profile = await this.#client.call(PreparedQueryIterEntriesRequest(this.#queryId, params, iterId));
    return this.#client.createIterator<O>(iterId, profile);
  }

  async all(params?: P): Promise<R[]> {
    return (await this.#client.call(PreparedQueryAllRequest(this.#queryId, params))) as R[];
  }

  async allEntries(params?: P): Promise<O[]> {
    return (await this.#client.call(PreparedQueryAllEntriesRequest(this.#queryId, params))) as O[];
  }

  async first(params?: P): Promise<R | undefined> {
    return (await this.#client.call(PreparedQueryFirstRequest(this.#queryId, params))) as R | undefined;
  }

  async firstEntry(params?: P): Promise<O | undefined> {
    return (await this.#client.call(PreparedQueryFirstEntryRequest(this.#queryId, params))) as O | undefined;
  }

  async one(params?: P): Promise<R> {
    return (await this.#client.call(PreparedQueryOneRequest(this.#queryId, params))) as R;
  }

  async oneEntry(params?: P): Promise<O> {
    return (await this.#client.call(PreparedQueryOneEntryRequest(this.#queryId, params))) as O;
  }

  async execute(params?: P): Promise<void> {
    await this.#client.call(PreparedQueryExecuteRequest(this.#queryId, params));
  }

  async finalize(): Promise<void> {
    await this.#client.call(PreparedQueryFinalizeRequest(this.#queryId));
  }

  async columns(): Promise<ColumnName[]> {
    return await this.#client.call(PreparedQueryColumnsRequest(this.#queryId))
  }

  async expandSql(params?: P): Promise<string> {
    return await this.#client.call(PreparedQueryExpandSqlRequest(this.#queryId, params))
  }
}
