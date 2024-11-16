import { DB_PATH } from "./path.ts";
import { Pool, ResourceHandler } from "./resource-pool.ts";
import { AsyncConnection, AsyncSQLite, AsyncSQLiteWrapper } from "../sqlite.ts";

export const sqlite = new AsyncSQLiteWrapper(AsyncSQLite);

async function hasChunkedMaster(path: string): Promise<boolean> {
  try {
    await Deno.stat(path + ".master.json");
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e
  }
}

const hasChunkedReadonlyVersion = await hasChunkedMaster(DB_PATH);
const connectionHandler: ResourceHandler<AsyncConnection> = {
  createResource() {
    const vfs = hasChunkedReadonlyVersion ? 'deno-chunked-readonly-async' : 'deno-async';
    return sqlite.open(DB_PATH, { write: false, create: false, vfs });
  },
};

export const dbPool = new Pool({
  handler: connectionHandler,
  minCount: 10,
  maxCount: 100,
  scalingDurationMillis: 60000,
});
