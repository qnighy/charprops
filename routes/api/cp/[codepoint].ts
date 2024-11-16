import { FreshContext } from "$fresh/server.ts";
import { parseCodepoint } from "../../../lib/codepoint.ts";
import { dbPool } from "../../../lib/db/pool.ts";
import { readCharData } from "../../../lib/db/read.ts";

export const handler = async (_req: Request, ctx: FreshContext): Promise<Response> => {
  const { codepoint: codepointText } = ctx.params;
  const codepoint = parseCodepoint(codepointText);
  if (codepoint == null) {
    return new Response(null, { status: 404 });
  }

  await using dbBorrow = await dbPool.take();
  const db = dbBorrow.resource;
  const charData = await readCharData(db, codepoint.codepoint);
  return new Response(JSON.stringify(charData), { headers: { "Content-Type": "application/json" } });
};
