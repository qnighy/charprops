import { QueryParameterSet, Row, RowObject } from "sqlite";

export type WorkerRequest = ConnectRequest | CloseRequest | QueryRequest | QueryEntriesRequest;

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
}
export function QueryEntriesRequest(sql: string, params: QueryParameterSet): QueryEntriesRequest {
  return { type: "query-entries", id: 0, sql, params };
}

export type WorkerResponse = VoidResponse | ErrorResponse | RowsResponse | RowObjectsResponse;
export type VoidResponse = {
  type: "void";
  id: number;
};
export function VoidResponse(): VoidResponse {
  return { type: "void", id: 0 };
}
export type ErrorResponse = {
  type: "error";
  id: number;
  message: string;
};
export function ErrorResponse(message: string): ErrorResponse {
  return { type: "error", id: 0, message };
}
export type RowsResponse = {
  type: "rows";
  id: number;
  rows: Row[];
}
export function RowsResponse(rows: Row[]): RowsResponse {
  return { type: "rows", id: 0, rows };
}
export type RowObjectsResponse = {
  type: "row-objects";
  id: number;
  rows: RowObject[];
}
export function RowObjectsResponse(rows: RowObject[]): RowObjectsResponse {
  return { type: "row-objects", id: 0, rows };
}
