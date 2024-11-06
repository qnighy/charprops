import { Handlers, PageProps } from "$fresh/server.ts";
import { CodePoint, parseCodePoint, stringifyCodePoint } from "../../lib/codepoint.ts";

export type CodePointPageData = {
  codepoint: CodePoint;
};

export const handler: Handlers<CodePointPageData> = {
  GET(_req, ctx) {
    const { codepoint: codepointText } = ctx.params;
    const codepoint = parseCodePoint(codepointText);
    if (codepoint == null) {
      return ctx.renderNotFound();
    }

    const normalizedCodepoint = stringifyCodePoint(codepoint);
    if (normalizedCodepoint !== codepointText) {
      return new Response(null, { status: 301, headers: { Location: `/cp/${normalizedCodepoint}` } });
    }
    return ctx.render({ codepoint });
  },
};

export default function CodepointPage(page: PageProps<CodePointPageData>) {
  const { codepoint } = page.data;

  return (
    <div>
      codepoint is {stringifyCodePoint(codepoint)}
    </div>
  );
}
