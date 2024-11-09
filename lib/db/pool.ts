import { DB_PATH } from "./path.ts";
import { Pool, ResourceHandler } from "./resource-pool.ts";
import { DB } from "./worker-client.ts";

const connectionHandler: ResourceHandler<DB> = {
  async createResource() {
    return await DB.connect(DB_PATH);
  },
  async disposeResource(resource) {
    await resource.close();
  },
};

export const dbPool = new Pool({
  handler: connectionHandler,
  minCount: 10,
  maxCount: 100,
  scalingDurationMillis: 60000,
});
