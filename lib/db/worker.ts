import { DB, type PreparedQuery } from "sqlite";
import { ErrorResponse, ValueResponse, WorkerReturnValues, type WorkerRequest, type WorkerResponse } from "./worker-protocol.ts";

let conn: DB | null = null;
const queries: Map<number, PreparedQuery> = new Map();
const iters: Map<number, IterableIterator<unknown>> = new Map();

self.onmessage = onmessage

function onmessage(ev: MessageEvent<WorkerRequest>) {
  let resp: WorkerResponse;
  try {
    resp = ValueResponse(processMessage(ev.data));
  } catch (e) {
    resp = ErrorResponse((e as Error).message);
  }
  resp.id = ev.data.id;
  self.postMessage(resp);
}
function processMessage(msg: WorkerRequest): unknown {
  switch (msg.type) {
    case "connect":
      if (conn) {
        throw new Error("Already connected");
      }
      conn = new DB(msg.path, {
        mode: msg.mode,
        memory: msg.memory,
        uri: msg.uri,
      });
      return;
    case "close":
      getConn().close(msg.force);
      conn = null;
      queries.clear();
      iters.clear();
      return;
    case "query":
      return getConn().query(msg.sql, msg.params) satisfies WorkerReturnValues["query"];
    case "query-entries":
      return getConn().queryEntries(msg.sql, msg.params) satisfies WorkerReturnValues["query-entries"];
    case "prepare-query": {
      queries.set(msg.queryId, getConn().prepareQuery(msg.sql));
      return;
    }
    case "execute":
      if (!conn) {
        throw new Error("Not connected");
      }
      return conn.execute(msg.sql) satisfies WorkerReturnValues["execute"];
    case "serialize":
      if (!conn) {
        throw new Error("Not connected");
      }
      return conn.serialize(msg.schema) satisfies WorkerReturnValues["serialize"];
    case "deserialize":
      if (!conn) {
        throw new Error("Not connected");
      }
      return conn.deserialize(msg.data, msg.options) satisfies WorkerReturnValues["deserialize"];
    case "prepared-query-iter": {
      const query = getQuery(msg.queryId);
      const iter: IterableIterator<unknown> = query.iter(msg.params);
      iters.set(msg.iterId, iter);
      return {
        hasReturn: iter.return != null,
        hasThrow: iter.throw != null,
      } satisfies WorkerReturnValues["prepared-query-iter"];
    }
    case "prepared-query-iter-entries": {
      const query = getQuery(msg.queryId);
      const iter: IterableIterator<unknown> = query.iterEntries(msg.params);
      iters.set(msg.iterId, iter);
      return {
        hasReturn: iter.return != null,
        hasThrow: iter.throw != null,
      } satisfies WorkerReturnValues["prepared-query-iter-entries"];
    }
    case "prepared-query-all":
      return getQuery(msg.queryId).all(msg.params) satisfies WorkerReturnValues["prepared-query-all"];
    case "prepared-query-all-entries":
      return getQuery(msg.queryId).allEntries(msg.params) satisfies WorkerReturnValues["prepared-query-all-entries"];
    case "prepared-query-first":
      return getQuery(msg.queryId).first(msg.params) satisfies WorkerReturnValues["prepared-query-first"];
    case "prepared-query-first-entry":
      return getQuery(msg.queryId).firstEntry(msg.params) satisfies WorkerReturnValues["prepared-query-first-entry"];
    case "prepared-query-one":
      return getQuery(msg.queryId).one(msg.params) satisfies WorkerReturnValues["prepared-query-one"];
    case "prepared-query-one-entry":
      return getQuery(msg.queryId).oneEntry(msg.params) satisfies WorkerReturnValues["prepared-query-one-entry"];
    case "prepared-query-execute":
      return getQuery(msg.queryId).execute(msg.params) satisfies WorkerReturnValues["prepared-query-execute"];
    case "prepared-query-finalize":
      getQuery(msg.queryId).finalize();
      queries.delete(msg.queryId);
      return;
    case "prepared-query-columns":
      return getQuery(msg.queryId).columns() satisfies WorkerReturnValues["prepared-query-columns"];
    case "prepared-query-expand-sql":
      return getQuery(msg.queryId).expandSql(msg.params) satisfies WorkerReturnValues["prepared-query-expand-sql"];
    case "iterator-next":
      return getIter(msg.iterId).next() satisfies WorkerReturnValues["iterator-next"];
    case "iterator-next-with-value":
      return getIter(msg.iterId).next(msg.value) satisfies WorkerReturnValues["iterator-next-with-value"];
    case "iterator-return":
      return getIter(msg.iterId).return!() satisfies WorkerReturnValues["iterator-return"];
    case "iterator-return-with-value":
      return getIter(msg.iterId).return!(msg.value) satisfies WorkerReturnValues["iterator-return-with-value"];
    case "iterator-throw":
      return getIter(msg.iterId).throw!(msg.error) satisfies WorkerReturnValues["iterator-throw"];
    default:
      throw new Error(`Unknown message type: ${(msg as { type: "$invalid" }).type}`);
  }
}

function getConn(): DB {
  if (!conn) {
    throw new Error("Not connected");
  }
  return conn;
}

function getQuery(queryId: number): PreparedQuery {
  if (!conn) {
    throw new Error("Not connected");
  }
  const query = queries.get(queryId);
  if (!query) {
    throw new Error(`Unknown query ID: ${queryId}`);
  }
  return query;
}

function getIter(iterId: number): IterableIterator<unknown> {
  if (!conn) {
    throw new Error("Not connected");
  }
  const iter = iters.get(iterId);
  if (!iter) {
    throw new Error(`Unknown iter ID: ${iterId}`);
  }
  return iter;
}
