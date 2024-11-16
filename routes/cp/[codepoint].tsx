import { Fragment } from "preact";
import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { Codepoint, parseCodepoint, stringifyCodepoint } from "../../lib/codepoint.ts";
import { readCharData } from "../../lib/db/read.ts";
import { dbPool } from "../../lib/db/pool.ts";
import { GeneralCategoryAbbr } from "../../lib/ucd/parser.ts";
import { CompressedCharData, expandFlags } from "../../lib/flags.ts";
import { charTags } from "../../lib/tag.ts";

export type CharPageData = {
  codepoint: Codepoint;
  charData: CompressedCharData;
};

export const handler: Handlers<CharPageData> = {
  async GET(_req, ctx) {
    const { codepoint: codepointText } = ctx.params;
    const codepoint = parseCodepoint(codepointText);
    if (codepoint == null) {
      return ctx.renderNotFound();
    }

    const normalizedCodepoint = stringifyCodepoint(codepoint);
    if (normalizedCodepoint !== codepointText) {
      return new Response(null, { status: 301, headers: { Location: `/cp/${normalizedCodepoint}` } });
    }

    await using dbBorrow = await dbPool.take();
    const db = dbBorrow.resource;
    const charData = await readCharData(db, codepoint.codepoint);
    return ctx.render({ codepoint, charData });
  },
};

const NON_PRINTABLE_CATEGORIES = new Set<GeneralCategoryAbbr>(["Cc", "Cf", "Cs", "Co", "Cn"]);

export default function CodepointPage(page: PageProps<CharPageData>) {
  const { codepoint, charData: compressedCharData } = page.data;
  const charData = expandFlags(compressedCharData);

  const printableValue =
    NON_PRINTABLE_CATEGORIES.has(charData.generalCategory)
      ? undefined
      : String.fromCodePoint(codepoint.codepoint);

  const tags = charTags(charData);
  const tagsByTagCategory = new Map<string, string[]>();
  for (const tag of tags) {
    const tagCategoryName = tagCategory(tag);
    let tagCategoryTags = tagsByTagCategory.get(tagCategoryName);
    if (tagCategoryTags == null) {
      tagCategoryTags = [];
      tagsByTagCategory.set(tagCategoryName, tagCategoryTags);
    }
    tagCategoryTags.push(tag);
  }

  return (
    <>
      <Head>
        <title>{stringifyCodepoint(codepoint)}{" "}{charData.name}{printableValue && ` - ${printableValue}`}</title>
      </Head>
      <div class="px-4 py-8 mx-auto bg-emerald-50 text-zinc-800">
        <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
          <h1 class="text-4xl font-bold">{stringifyCodepoint(codepoint)}{" "}{charData.name}</h1>
          <p class="text-9xl my-4 size-32 rounded border-2 border-stone-200 border-solid bg-stone-50 grid grid-cols-1">
            <span class="text-center align-middle">
              {printableValue}
            </span>
          </p>
          <table class="border-collapse table-fixed w-4/5">
            <tbody>
              {
                tagCategories().map((tagCategoryName) => {
                  const tags = tagsByTagCategory.get(tagCategoryName);
                  if (tags == null) {
                    return null;
                  }
                  return (
                    <tr key={tagCategoryName}>
                      <th class="border border-slate-300 text-right px-4">{tagCategoryName}</th>
                      <td class="border border-slate-300 text-left px-4">{
                        tags.map((tag) => (
                          <Fragment key={tag}>
                            <Tag tag={tag} />
                            {" "}
                          </Fragment>
                        ))
                      }</td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

type TagProps = {
  tag: string;
};

function Tag(props: TagProps) {
  const { tag } = props;
  const [tagPropertyName, tagPropertyValue] = splitTag(tag);
  return (
    <a href={`/tag/${tag}`}>
      <span class="px-1">
        <span class="inline-block ps-2 pe-0.5 py-1 text-xs font-semibold text-white bg-slate-600 rounded-s-full">
          {tagPropertyName}
          =
        </span>
        <span class="inline-block ps-0.5 pe-2 py-1 text-xs font-semibold text-white bg-emerald-500 rounded-e-full">
          {tagPropertyValue}
        </span>
      </span>
    </a>
  );
}

function tagCategory(tag: string): string {
  const [tagPropertyName] = splitTag(tag);
  switch (tagPropertyName) {
    case "gc":
      return "General Category";
    default:
      return "Others";
  }
}

function splitTag(tag: string): [string, string] {
  const eqIndex = tag.indexOf("=");
  return eqIndex === -1 ? [tag, ""] : [tag.slice(0, eqIndex), tag.slice(eqIndex + 1)];
}

function tagCategories(): string[] {
  return ["General Category", "Others"];
}
