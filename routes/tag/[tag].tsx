import { Fragment } from "preact";
import { Handlers, PageProps } from "$fresh/server.ts";
import { Head } from "$fresh/runtime.ts";
import { dbPool } from "../../lib/db/pool.ts";
import { readTag, readTagCodepoints } from "../../lib/db/read.ts";
import { CompressedCodePointData, expandFlags } from "../../lib/flags.ts";
import { normalizeTag } from "../../lib/normalize-tag.ts";
import { GeneralCategoryAbbr } from "../../lib/ucd/parser.ts";
import { stringifyCodePoint } from "../../lib/codepoint.ts";

export type TagData = {
  tag: string;
  chars: {
    rows: CompressedCodePointData[];
    next: string | undefined;
  };
};

export const handler: Handlers<TagData> = {
  async GET(_req, ctx) {
    const { tag } = ctx.params;
    const normalizedTag = normalizeTag(tag);
    if (normalizedTag !== tag) {
      return new Response(null, { status: 301, headers: { Location: `/tag/${normalizedTag}` } });
    }

    await using dbBorrow = await dbPool.take();
    const db = dbBorrow.resource;
    const tagId = await readTag(db, tag);
    if (tagId == null) {
      return ctx.renderNotFound();
    }
    const chars = await readTagCodepoints(db, tagId);
    return ctx.render({ tag, chars });
  },
};

const NON_PRINTABLE_CATEGORIES = new Set<GeneralCategoryAbbr>(["Cc", "Cf", "Cs", "Co", "Cn"]);

export default function CodepointPage(page: PageProps<TagData>) {
  const { tag, chars } = page.data;

  return (
    <>
      <Head>
        <title>{tag}</title>
      </Head>
      <div class="px-4 py-8 mx-auto bg-emerald-50 text-zinc-800">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <h1 class="text-4xl font-bold">{tag}</h1>
          <div class="flex flex-row flex-wrap">
            {chars.rows.map((compressed) => {
              const charData = expandFlags(compressed);
              const printableValue =
                NON_PRINTABLE_CATEGORIES.has(charData.generalCategory)
                  ? undefined
                  : String.fromCodePoint(charData.codepoint);
              const codepointString = stringifyCodePoint({ type: "UnicodeCodePoint", codepoint: charData.codepoint });
              return (
                <Fragment key={codepointString}>
                  <a href={`/cp/${codepointString}`}>
                    <div title={charData.name} class="text-7xl my-2 size-16 rounded border-2 border-stone-200 border-solid bg-stone-50 grid grid-cols-1">
                      <div class="text-center align-middle">
                        {printableValue}
                      </div>
                    </div>
                  </a>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
