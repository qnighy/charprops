import { DB_PATH } from "./path.ts";
import { generateChunkedAsync } from "../sqlite/async-deno-chunked-readonly-vfs.ts";

export async function finalize() {
  await generateChunkedAsync(DB_PATH);
  await Deno.remove(DB_PATH);
}

if (import.meta.main) {
  await finalize();
}
