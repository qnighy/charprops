import { DB_PATH } from "./path.ts";
import { Pool, ResourceHandler } from "./resource-pool.ts";
import { AsyncConnection, AsyncSQLite, AsyncSQLiteWrapper } from "../sqlite.ts";

export const sqlite = new AsyncSQLiteWrapper(AsyncSQLite);

const connectionHandler: ResourceHandler<AsyncConnection> = {
  createResource() {
    return sqlite.open(DB_PATH);
  },
};

export const dbPool = new Pool({
  handler: connectionHandler,
  minCount: 10,
  maxCount: 100,
  scalingDurationMillis: 60000,
});
