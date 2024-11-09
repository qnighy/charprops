import { DB } from "sqlite";
import { ErrorResponse, RowObjectsResponse, RowsResponse, VoidResponse, type WorkerRequest, type WorkerResponse } from "./worker-protocol.ts";

let conn: DB | null = null;

self.onmessage = onmessage

function onmessage(ev: MessageEvent<WorkerRequest>) {
  let resp: WorkerResponse;
  try {
    resp = processMessage(ev.data);
  } catch (e) {
    resp = ErrorResponse((e as Error).message);
  }
  resp.id = ev.data.id;
  self.postMessage(resp);
}
function processMessage(msg: WorkerRequest): WorkerResponse {
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
      return VoidResponse();
    case "close":
      if (!conn) {
        throw new Error("Not connected");
      }
      conn.close(msg.force);
      conn = null;
      return VoidResponse();
    case "query":
      if (!conn) {
        throw new Error("Not connected");
      }
      return RowsResponse(conn.query(msg.sql, msg.params));
    case "query-entries":
      if (!conn) {
        throw new Error("Not connected");
      }
      return RowObjectsResponse(conn.queryEntries(msg.sql, msg.params));
  }
}
