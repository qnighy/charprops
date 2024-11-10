import { FreshContext } from "$fresh/server.ts";
import { parseCodePoint } from "../../../lib/codepoint.ts";
import { dbPool } from "../../../lib/db/pool.ts";

export const handler = async (_req: Request, ctx: FreshContext): Promise<Response> => {
  const { codepoint: codepointText } = ctx.params;
  const codepoint = parseCodePoint(codepointText);
  if (codepoint == null) {
    return new Response(null, { status: 404 });
  }

  await using dbBorrow = await dbPool.take();
  const db = dbBorrow.resource;
  const result = await db.query<[codepoint: number, name: string]>("SELECT codepoint, name FROM codepoints WHERE codepoint = $1 LIMIT 1", [codepoint.codepoint]);
  if (result.length === 0) {
    // TODO
    return new Response(null, { status: 404 });
  }
  const [[respCodepoint, name]] = result;
  const respBody = {
    codepoint: respCodepoint,
    name,
  };
  return new Response(JSON.stringify(respBody), { headers: { "Content-Type": "application/json" } });
};
