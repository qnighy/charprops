import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { CodePoint, parseCodePoint, stringifyCodePoint } from "../../lib/codepoint.ts";
import { CodePointData, readCodePoint } from "../../lib/db/read.ts";
import { dbPool } from "../../lib/db/pool.ts";
import { GeneralCategoryAbbr } from "../../lib/ucd/parser.ts";

export type CodePointPageData = {
  codepoint: CodePoint;
  codepointData: CodePointData;
};

export const handler: Handlers<CodePointPageData> = {
  async GET(_req, ctx) {
    const { codepoint: codepointText } = ctx.params;
    const codepoint = parseCodePoint(codepointText);
    if (codepoint == null) {
      return ctx.renderNotFound();
    }

    const normalizedCodepoint = stringifyCodePoint(codepoint);
    if (normalizedCodepoint !== codepointText) {
      return new Response(null, { status: 301, headers: { Location: `/cp/${normalizedCodepoint}` } });
    }

    await using dbBorrow = await dbPool.take();
    const db = dbBorrow.resource;
    const codepointData = readCodePoint(db, codepoint.codepoint);
    return ctx.render({ codepoint, codepointData });
  },
};

const NON_PRINTABLE_CATEGORIES = new Set<GeneralCategoryAbbr>(["Cc", "Cf", "Cs", "Co", "Cn"]);

export default function CodepointPage(page: PageProps<CodePointPageData>) {
  const { codepoint, codepointData } = page.data;

  const printableValue =
    NON_PRINTABLE_CATEGORIES.has(codepointData.generalCategory)
      ? undefined
      : String.fromCodePoint(codepoint.codepoint);

  return (
    <>
      <Head>
        <title>{stringifyCodePoint(codepoint)}{" "}{codepointData.name}{printableValue && ` - ${printableValue}`}</title>
      </Head>
      <div class="px-4 py-8 mx-auto bg-emerald-50 text-zinc-800">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <h1 class="text-4xl font-bold">{stringifyCodePoint(codepoint)}{" "}{codepointData.name}</h1>
          {printableValue && (
            <p class="text-9xl my-4 size-32 rounded border-2 border-stone-200 border-solid bg-stone-50 grid grid-cols-1">
              <span class="text-center align-middle">
                {printableValue}
              </span>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
