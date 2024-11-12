import { DB_PATH } from "./path.ts";
import { Pool, ResourceHandler } from "./resource-pool.ts";
import { DB } from "sqlite";

const connectionHandler: ResourceHandler<DB> = {
  createResource() {
    return new DB(DB_PATH, { mode: "read" });
  },
  disposeResource(resource) {
    resource.close();
  },
};

export const dbPool = new Pool({
  handler: connectionHandler,
  minCount: 10,
  maxCount: 100,
  scalingDurationMillis: 60000,
});
