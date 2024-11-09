import { ColumnName, QueryParameterSet, Row, RowObject, SqliteDeserializeOptions } from "sqlite";

export type WorkerRequest =
  | ConnectRequest
  | CloseRequest
  | QueryRequest
  | QueryEntriesRequest
  | PrepareQueryRequest
  | ExecuteRequest
  | SerializeRequest
  | DeserializeRequest
  | PreparedQueryIterRequest
  | PreparedQueryIterEntriesRequest
  | PreparedQueryAllRequest
  | PreparedQueryAllEntriesRequest
  | PreparedQueryFirstRequest
  | PreparedQueryFirstEntryRequest
  | PreparedQueryOneRequest
  | PreparedQueryOneEntryRequest
  | PreparedQueryExecuteRequest
  | PreparedQueryFinalizeRequest
  | PreparedQueryColumnsRequest
  | PreparedQueryExpandSqlRequest
  | IteratorNextRequest
  | IteratorNextWithValueRequest
  | IteratorReturnRequest
  | IteratorReturnWithValueRequest
  | IteratorThrowRequest;

export type WorkerReturnValues = {
  "connect": void;
  "close": void;
  "query": Row[];
  "query-entries": RowObject[];
  "prepare-query": void;
  "execute": void;
  "serialize": Uint8Array;
  "deserialize": void;
  "prepared-query-iter": IteratorProfile;
  "prepared-query-iter-entries": IteratorProfile;
  "prepared-query-all": Row[];
  "prepared-query-all-entries": RowObject[];
  "prepared-query-first": Row | undefined;
  "prepared-query-first-entry": RowObject | undefined;
  "prepared-query-one": Row | undefined;
  "prepared-query-one-entry": RowObject | undefined;
  "prepared-query-execute": void;
  "prepared-query-finalize": void;
  "prepared-query-columns": ColumnName[];
  "prepared-query-expand-sql": string;
  "iterator-next": IteratorResult<unknown>;
  "iterator-next-with-value": IteratorResult<unknown>;
  "iterator-return": IteratorResult<unknown>;
  "iterator-return-with-value": IteratorResult<unknown>;
  "iterator-throw": IteratorResult<unknown>;
};

export type ConnectRequest = {
  type: "connect";
  id: number;
  path: string;
  mode: "read" | "write" | "create";
  memory: boolean;
  uri: boolean;
};
export function ConnectRequest(
  path: string,
  options: {
    mode: "read" | "write" | "create";
    memory: boolean;
    uri: boolean;
  },
): ConnectRequest {
  return { type: "connect", id: 0, path, mode: options.mode, memory: options.memory, uri: options.uri };
}
export type CloseRequest = {
  type: "close";
  id: number;
  force: boolean;
};
export function CloseRequest(force: boolean): CloseRequest {
  return { type: "close", id: 0, force };
}
export type QueryRequest = {
  type: "query";
  id: number;
  sql: string;
  params: QueryParameterSet;
}
export function QueryRequest(sql: string, params: QueryParameterSet): QueryRequest {
  return { type: "query", id: 0, sql, params };
}
export type QueryEntriesRequest = {
  type: "query-entries";
  id: number;
  sql: string;
  params: QueryParameterSet;
};
export function QueryEntriesRequest(sql: string, params: QueryParameterSet): QueryEntriesRequest {
  return { type: "query-entries", id: 0, sql, params };
}
export type PrepareQueryRequest = {
  type: "prepare-query";
  id: number;
  sql: string;
  queryId: number;
};
export function PrepareQueryRequest(sql: string, queryId: number): PrepareQueryRequest {
  return { type: "prepare-query", id: 0, sql, queryId };
}
export type ExecuteRequest = {
  type: "execute";
  id: number;
  sql: string;
};
export function ExecuteRequest(sql: string): ExecuteRequest {
  return { type: "execute", id: 0, sql };
}
export type SerializeRequest = {
  type: "serialize";
  id: number;
  schema: string;
};
export function SerializeRequest(schema: string): SerializeRequest {
  return { type: "serialize", id: 0, schema };
}
export type DeserializeRequest = {
  type: "deserialize";
  id: number;
  data: Uint8Array;
  options: SqliteDeserializeOptions;
};
export function DeserializeRequest(data: Uint8Array, options: SqliteDeserializeOptions): DeserializeRequest {
  return { type: "deserialize", id: 0, data, options };
}
export type PreparedQueryIterRequest = {
  type: "prepared-query-iter";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
  iterId: number;
};
export function PreparedQueryIterRequest(queryId: number, params: QueryParameterSet | undefined, iterId: number): PreparedQueryIterRequest {
  return { type: "prepared-query-iter", id: 0, queryId, params, iterId };
}
export type PreparedQueryIterEntriesRequest = {
  type: "prepared-query-iter-entries";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
  iterId: number;
};
export function PreparedQueryIterEntriesRequest(queryId: number, params: QueryParameterSet | undefined, iterId: number): PreparedQueryIterEntriesRequest {
  return { type: "prepared-query-iter-entries", id: 0, queryId, params, iterId };
}
export type PreparedQueryAllRequest = {
  type: "prepared-query-all";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryAllRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryAllRequest {
  return { type: "prepared-query-all", id: 0, queryId, params };
}
export type PreparedQueryAllEntriesRequest = {
  type: "prepared-query-all-entries";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryAllEntriesRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryAllEntriesRequest {
  return { type: "prepared-query-all-entries", id: 0, queryId, params };
}
export type PreparedQueryFirstRequest = {
  type: "prepared-query-first";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryFirstRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryFirstRequest {
  return { type: "prepared-query-first", id: 0, queryId, params };
}
export type PreparedQueryFirstEntryRequest = {
  type: "prepared-query-first-entry";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryFirstEntryRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryFirstEntryRequest {
  return { type: "prepared-query-first-entry", id: 0, queryId, params };
}
export type PreparedQueryOneRequest = {
  type: "prepared-query-one";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryOneRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryOneRequest {
  return { type: "prepared-query-one", id: 0, queryId, params };
}
export type PreparedQueryOneEntryRequest = {
  type: "prepared-query-one-entry";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryOneEntryRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryOneEntryRequest {
  return { type: "prepared-query-one-entry", id: 0, queryId, params };
}
export type PreparedQueryExecuteRequest = {
  type: "prepared-query-execute";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryExecuteRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryExecuteRequest {
  return { type: "prepared-query-execute", id: 0, queryId, params };
}
export type PreparedQueryFinalizeRequest = {
  type: "prepared-query-finalize";
  id: number;
  queryId: number;
};
export function PreparedQueryFinalizeRequest(queryId: number): PreparedQueryFinalizeRequest {
  return { type: "prepared-query-finalize", id: 0, queryId };
}
export type PreparedQueryColumnsRequest = {
  type: "prepared-query-columns";
  id: number;
  queryId: number;
};
export function PreparedQueryColumnsRequest(queryId: number): PreparedQueryColumnsRequest {
  return { type: "prepared-query-columns", id: 0, queryId };
}
export type PreparedQueryExpandSqlRequest = {
  type: "prepared-query-expand-sql";
  id: number;
  queryId: number;
  params: QueryParameterSet | undefined;
};
export function PreparedQueryExpandSqlRequest(queryId: number, params: QueryParameterSet | undefined): PreparedQueryExpandSqlRequest {
  return { type: "prepared-query-expand-sql", id: 0, queryId, params };
}
export type IteratorNextRequest = {
  type: "iterator-next";
  id: number;
  iterId: number;
};
export function IteratorNextRequest(iterId: number): IteratorNextRequest {
  return { type: "iterator-next", id: 0, iterId };
}
export type IteratorNextWithValueRequest = {
  type: "iterator-next-with-value";
  id: number;
  iterId: number;
  value: unknown;
};
export function IteratorNextWithValueRequest(iterId: number, value: unknown): IteratorNextWithValueRequest {
  return { type: "iterator-next-with-value", id: 0, iterId, value };
}
export type IteratorReturnRequest = {
  type: "iterator-return";
  id: number;
  iterId: number;
};
export function IteratorReturnRequest(iterId: number): IteratorReturnRequest {
  return { type: "iterator-return", id: 0, iterId };
}
export type IteratorReturnWithValueRequest = {
  type: "iterator-return-with-value";
  id: number;
  iterId: number;
  value: unknown;
};
export function IteratorReturnWithValueRequest(iterId: number, value: unknown): IteratorReturnWithValueRequest {
  return { type: "iterator-return-with-value", id: 0, iterId, value };
}
export type IteratorThrowRequest = {
  type: "iterator-throw";
  id: number;
  iterId: number;
  error: unknown;
};
export function IteratorThrowRequest(iterId: number, error: unknown): IteratorThrowRequest {
  return { type: "iterator-throw", id: 0, iterId, error };
}

export type WorkerResponse = ValueResponse | ErrorResponse;
export type ValueResponse = {
  type: "value";
  id: number;
  value: unknown;
}
export function ValueResponse(value: unknown): ValueResponse {
  return { type: "value", id: 0, value };
}
export type ErrorResponse = {
  type: "error";
  id: number;
  message: string;
};
export function ErrorResponse(message: string): ErrorResponse {
  return { type: "error", id: 0, message };
}

export type IteratorProfile = {
  hasReturn: boolean;
  hasThrow: boolean;
}
