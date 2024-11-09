import { FreshContext } from "$fresh/server.ts";
import { parseCodePoint } from "../../../lib/codepoint.ts";
import { db } from "../../../lib/db/conn.ts";

export const handler = (_req: Request, ctx: FreshContext): Response => {
  const { codepoint: codepointText } = ctx.params;
  const codepoint = parseCodePoint(codepointText);
  if (codepoint == null) {
    return new Response(null, { status: 404 });
  }

  const result = db.query<[codepoint: number, name: string]>("SELECT codepoint, name FROM codepoints WHERE codepoint = $1 LIMIT 1", [codepoint.codepoint]);
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
