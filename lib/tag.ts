import { CharData } from "./flags.ts";
import { BidiClass, DecompositionType, GeneralCategoryAbbr } from "./ucd/parser.ts";

const ALL_TAG_VALUES: Record<string, string[]> = {
  gc: [
    "Lu", "Ll", "Lt", "LC", "Lm", "Lo", "L",
    "Mn", "Mc", "Me", "M",
    "Nd", "Nl", "No", "N",
    "Pc", "Pd", "Ps", "Pe", "Pi", "Pf", "Po", "P",
    "Sm", "Sc", "Sk", "So", "S",
    "Zs", "Zl", "Zp", "Z",
    "Cc", "Cf", "Cs", "Co", "Cn", "C",
  ] satisfies (GeneralCategoryAbbr | "LC" | "L" | "M" | "N" | "P" | "S" | "Z" | "C")[],
  ccc: Array.from({ length: 256 }, (_, i) => i.toString()).filter((s) => s !== "133" && s !== "255"),
  bc: [
    "L", "R", "AL",
    "EN", "ES", "ET", "AN",
    "CS", "NSM", "BN",
    "B", "S", "WS", "ON",
    "LRE", "LRO", "RLE", "RLO", "PDF",
    "LRI", "RLI", "FSI", "PDI",
  ] satisfies BidiClass[],
  dt: [
    "None", "Can", "Com",
    "Enc", "Fin", "Font", "Fra", "Init", "Iso", "Med", "Nar",
    "Nb", "Sml", "Sqr", "Sub", "Sup", "Vert", "Wide",
    "AnyCompat", "Any",
  ],
  // nt: [],
  "Bidi_M": ["Y"],
};

export function allTags(): string[] {
  const tags: string[] = [];
  for (const [tag, values] of Object.entries(ALL_TAG_VALUES)) {
    for (const value of values) {
      tags.push(`${tag}=${value}`);
    }
  }
  return tags;
}

export function charTags(charData: CharData): string[] {
  const tags: string[] = [];
  if (charData.generalCategory !== "Cn") {
    tags.push(`gc=${charData.generalCategory}`);
    for (const altTagValue of generalCategoryTags[charData.generalCategory]) {
      tags.push(`gc=${altTagValue}`);
    }
  }
  if (charData.canonicalCombiningClass !== 0) {
    tags.push(`ccc=${charData.canonicalCombiningClass}`);
  }
  if (charData.generalCategory !== "Cn") {
    tags.push(`bc=${charData.bidiClass}`);
  }
  if (charData.decompositionType != null) {
    tags.push(`dt=${decompositionTypeAbbreviations[charData.decompositionType]}`);
    if (charData.decompositionType !== "Canonical") {
      tags.push("dt=AnyCompat");
    }
    tags.push("dt=Any");
  }
  // if (charData.numericType != null) {
  //   tags.push(`nt=${charData.numericType}`);
  // }
  if (charData.bidiMirrored) {
    tags.push("Bidi_M=Y");
  }
  return tags;
}

const generalCategoryTags: Record<GeneralCategoryAbbr, string[]> = {
  Lu: ["LC", "L"],
  Ll: ["LC", "L"],
  Lt: ["LC", "L"],
  Lm: ["L"],
  Lo: ["L"],
  Mn: ["M"],
  Mc: ["M"],
  Me: ["M"],
  Nd: ["N"],
  Nl: ["N"],
  No: ["N"],
  Pc: ["P"],
  Pd: ["P"],
  Ps: ["P"],
  Pe: ["P"],
  Pi: ["P"],
  Pf: ["P"],
  Po: ["P"],
  Sm: ["S"],
  Sc: ["S"],
  Sk: ["S"],
  So: ["S"],
  Zs: ["Z"],
  Zl: ["Z"],
  Zp: ["Z"],
  Cc: ["C"],
  Cf: ["C"],
  Cs: ["C"],
  Co: ["C"],
  Cn: ["C"],
};

const decompositionTypeAbbreviations: Record<DecompositionType | "None", string> = {
  Canonical: "Can",
  Compat: "Com",
  Circle: "Enc",
  Final: "Fin",
  Font: "Font",
  Fraction: "Fra",
  Initial: "Init",
  Isolated: "Iso",
  Medial: "Med",
  Narrow: "Nar",
  NoBreak: "Nb",
  None: "None",
  Small: "Sml",
  Square: "Sqr",
  Sub: "Sub",
  Super: "Sup",
  Vertical: "Vert",
  Wide: "Wide",
};
