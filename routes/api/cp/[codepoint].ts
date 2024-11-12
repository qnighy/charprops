import { FreshContext } from "$fresh/server.ts";
import { parseCodePoint } from "../../../lib/codepoint.ts";
import { dbPool } from "../../../lib/db/pool.ts";
import { readCodePoint } from "../../../lib/db/read.ts";

export const handler = async (_req: Request, ctx: FreshContext): Promise<Response> => {
  const { codepoint: codepointText } = ctx.params;
  const codepoint = parseCodePoint(codepointText);
  if (codepoint == null) {
    return new Response(null, { status: 404 });
  }

  await using dbBorrow = await dbPool.take();
  const db = dbBorrow.resource;
  const data = readCodePoint(db, codepoint.codepoint);
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
};
