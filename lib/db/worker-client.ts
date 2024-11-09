import { QueryParameterSet, Row, SqliteOptions } from "sqlite";
import { CloseRequest, ConnectRequest, QueryRequest, WorkerRequest, WorkerResponse } from "./worker-protocol.ts";

const enableWorkerPermissions = false;

type WorkerClientOptions = {
  readPermissions: URL[];
  writePermissions: URL[];
};

class WorkerClient {
  #worker: Worker;
  #currentId = 1;
  #callbacks = new Map<number, (resp: WorkerResponse) => void>();

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

  call(req: WorkerRequest): Promise<WorkerResponse> {
    req.id = this.#currentId++;
    return new Promise((resolve, reject) => {
      this.#callbacks.set(req.id, (resp) => {
        if (resp.type === "error") {
          reject(new Error(resp.message));
        } else {
          resolve(resp);
        }
      });
      this.#worker.postMessage(req);
    });
  }

  close(): void {
    this.#worker.terminate();
  }
}

export class DB {
  static #privateConstructorKey: unknown = {};
  #client: WorkerClient;

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
    const resp = await this.#client.call(QueryRequest(sql, params));
    if (resp.type !== "rows") {
      throw new Error(`Unexpected response type: ${resp.type}`);
    }
    return resp.rows as R[];
  }

  async close(force = false): Promise<void> {
    try {
      await this.#client.call(CloseRequest(force));
    } finally {
      this.#client.close();
    }
  }
}
