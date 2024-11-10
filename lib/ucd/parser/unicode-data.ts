import { parseInteger, parseRow, parseShortBinaryValue, ensureEnum } from "./base.ts";
import { CodePointData, CodePointOrRange, CodePointRange, parseCodePoint, parseCodePointString } from "./codepoint.ts";
import { DerivableNameData, parseName, RangeIdentifierStartData, RegularNameData } from "./name.ts";

export type UnicodeDataRow = {
  codepoint: CodePointOrRange;
  name: RegularNameData | DerivableNameData;
  generalCategory: GeneralCategoryAbbr;
  canonicalCombiningClass: number;
  bidiClass: BidiClass;
  decomposition: Decomposition | null;
  /** You also need to read Unihan to get complete set of Numeric_Type / Numeric_Value values */
  numeric: NumericRepresentation | null;
  bidiMirrored: boolean;
  // Omitting Unicode_1_Name and ISO_Comment
  simpleUppercaseMapping: string | undefined;
  simpleLowercaseMapping: string | undefined;
  simpleTitlecaseMapping: string | undefined;
};

export type GeneralCategoryAbbr =
  | "Lu"
  | "Ll"
  | "Lt"
  | "Lm"
  | "Lo"
  | "Mn"
  | "Mc"
  | "Me"
  | "Nd"
  | "Nl"
  | "No"
  | "Pc"
  | "Pd"
  | "Ps"
  | "Pe"
  | "Pi"
  | "Pf"
  | "Po"
  | "Sm"
  | "Sc"
  | "Sk"
  | "So"
  | "Zs"
  | "Zl"
  | "Zp"
  | "Cc"
  | "Cf"
  | "Cs"
  | "Co"
  | "Cn";

const GENERAL_CATEGORIES = new Set<GeneralCategoryAbbr>([
  "Lu",
  "Ll",
  "Lt",
  "Lm",
  "Lo",
  "Mn",
  "Mc",
  "Me",
  "Nd",
  "Nl",
  "No",
  "Pc",
  "Pd",
  "Ps",
  "Pe",
  "Pi",
  "Pf",
  "Po",
  "Sm",
  "Sc",
  "Sk",
  "So",
  "Zs",
  "Zl",
  "Zp",
  "Cc",
  "Cf",
  "Cs",
  "Co",
  "Cn",
]);

export type BidiClass =
  | "L"
  | "R"
  | "AL"
  | "EN"
  | "ES"
  | "ET"
  | "AN"
  | "CS"
  | "NSM"
  | "BN"
  | "B"
  | "S"
  | "WS"
  | "ON"
  | "LRE"
  | "LRO"
  | "RLE"
  | "RLO"
  | "PDF"
  | "LRI"
  | "RLI"
  | "FSI"
  | "PDI";

const BIDI_CLASSES = new Set<BidiClass>([
  "L",
  "R",
  "AL",
  "EN",
  "ES",
  "ET",
  "AN",
  "CS",
  "NSM",
  "BN",
  "B",
  "S",
  "WS",
  "ON",
  "LRE",
  "LRO",
  "RLE",
  "RLO",
  "PDF",
  "LRI",
  "RLI",
  "FSI",
  "PDI",
]);

export type Decomposition = {
  decompositionType: DecompositionType;
  decompositionMapping: string;
};

export type DecompositionType =
  | "Canonical"
  | "Font"
  | "NoBreak"
  | "Initial"
  | "Medial"
  | "Final"
  | "Isolated"
  | "Circle"
  | "Super"
  | "Sub"
  | "Vertical"
  | "Wide"
  | "Narrow"
  | "Small"
  | "Square"
  | "Fraction"
  | "Compat";

const DECOMPOSITION_TYPES = new Map<string, DecompositionType>([
  ["<font>", "Font"],
  ["<noBreak>", "NoBreak"],
  ["<initial>", "Initial"],
  ["<medial>", "Medial"],
  ["<final>", "Final"],
  ["<isolated>", "Isolated"],
  ["<circle>", "Circle"],
  ["<super>", "Super"],
  ["<sub>", "Sub"],
  ["<vertical>", "Vertical"],
  ["<wide>", "Wide"],
  ["<narrow>", "Narrow"],
  ["<small>", "Small"],
  ["<square>", "Square"],
  ["<fraction>", "Fraction"],
  ["<compat>", "Compat"],
]);

export type NumericRepresentation = {
  numericType: NumericType;
  /**
   * /[0-9]/ for numericType === "Decimal" or numericType === "Digit",
   * but you should treat Digit like Numeric.
   * /(0|-?[1-9][0-9]*)(\/[1-9][0-9]*)?/ for numericType === "Numeric".
  */
  numericValue: string;
};

export type NumericType =
  | "Decimal"
  | "Digit"
  | "Numeric";

type UnicodeDataRow01 = {
  codepoint: CodePointOrRange;
  name: RegularNameData | DerivableNameData;
};

export async function* parseUnicodeData(lines: AsyncIterable<string> | Iterable<string>): AsyncIterable<UnicodeDataRow> {
  let lastRangeStart: { name: RangeIdentifierStartData, codepoint: number } | null = null;
  for await (const line of lines) {
    const dataElems = parseRow(line);
    if (dataElems == null) {
      continue;
    }
    if (dataElems.length < 15) {
      throw new SyntaxError(`Invalid row: ${line}`);
    }
    const [
      codepointText,
      nameText,
      generalCategoryText,
      canonicalCombiningClassText,
      bidiClassText,
      decompositionText,
      decimalText,
      digitText,
      numericText,
      bidiMirroredText,
      /* Unicode_1_Name */,
      /* ISO_Comment */,
      simpleUppercaseMappingCodepoints,
      simpleLowercaseMappingCodepoints,
      simpleTitlecaseMappingCodepoints,
    ] = dataElems;
    const codepoint = parseCodePoint(codepointText);
    const nameData = parseName(nameText);
    let row01: UnicodeDataRow01;
    if (lastRangeStart != null) {
      if (nameData.type !== "RangeIdentifierEnd" || nameData.identifier !== lastRangeStart.name.identifier) {
        throw new SyntaxError(`Expected range end of the same name as ${lastRangeStart.name.identifier}, got: ${nameText}`);
      }
      const { codepoint: startCodepoint } = lastRangeStart;
      lastRangeStart = null;
      row01 = {
        codepoint: CodePointRange(startCodepoint, codepoint),
        name: DerivableNameData(nameData.identifier),
      };
    } else if (nameData.type === "RangeIdentifierStart") {
      lastRangeStart = { name: nameData, codepoint: codepoint };
      continue;
    } else if (nameData.type === "RangeIdentifierEnd") {
      throw new SyntaxError(`Unexpected range end: ${nameText}`);
    } else {
      row01 = {
        codepoint: CodePointData(codepoint),
        name: nameData,
      };
    }

    const generalCategory = ensureEnum(generalCategoryText, GENERAL_CATEGORIES);
    const canonicalCombiningClass = parseInteger(canonicalCombiningClassText);
    const bidiClass = ensureEnum(bidiClassText, BIDI_CLASSES);
    const decomposition = parseDecomposition(decompositionText);
    const numeric = parseNumericRepresentation(decimalText, digitText, numericText);
    const bidiMirrored = parseShortBinaryValue(bidiMirroredText);
    const simpleUppercaseMapping = parseSingleCharacterMapping(simpleUppercaseMappingCodepoints);
    const simpleLowercaseMapping = parseSingleCharacterMapping(simpleLowercaseMappingCodepoints);
    const simpleTitlecaseMapping = parseSingleCharacterMapping(simpleTitlecaseMappingCodepoints) ?? simpleUppercaseMapping;

    yield {
      ...row01,
      generalCategory,
      canonicalCombiningClass,
      bidiClass,
      decomposition,
      numeric,
      bidiMirrored,
      simpleUppercaseMapping,
      simpleLowercaseMapping,
      simpleTitlecaseMapping,
    };
  }
}

function parseDecomposition(decompositionText: string): Decomposition | null {
  if (decompositionText === "") {
    return null;
  }
  if (decompositionText.startsWith("<")) {
    // Compatibility decomposition
    const m = /\s+/.exec(decompositionText);
    if (m == null) {
      throw new SyntaxError(`Invalid decomposition: ${decompositionText}`);
    }
    const head = decompositionText.substring(0, m.index);
    const tail = decompositionText.substring(m.index + m[0].length);
    const decompositionType = DECOMPOSITION_TYPES.get(head);
    if (decompositionType == null) {
      throw new SyntaxError(`Invalid decomposition type: ${head}`);
    }
    return {
      decompositionType,
      decompositionMapping: parseCodePointString(tail),
    };
  }
  // Canonical decomposition
  return {
    decompositionType: "Canonical",
    decompositionMapping: parseCodePointString(decompositionText),
  };
}

function parseNumericRepresentation(decimalText: string, digitText: string, numericText: string): NumericRepresentation | null {
  if (decimalText !== "") {
    if (decimalText !== digitText || decimalText !== numericText) {
      throw new SyntaxError(`Columns 6,7,8 must match, got ${decimalText};${digitText};${numericText}`);
    }
    if (!/^[0-9]+$/.test(decimalText)) {
      throw new SyntaxError(`Invalid decimal value: ${decimalText}`);
    }
    return {
      numericType: "Decimal",
      numericValue: decimalText,
    };
  }
  if (digitText !== "") {
    if (digitText !== numericText) {
      throw new SyntaxError(`Columns 7,8 must match, got ${digitText};${numericText}`);
    }
    if (!/^[0-9]$/.test(digitText)) {
      throw new SyntaxError(`Invalid digit value: ${digitText}`);
    }
    return {
      numericType: "Digit",
      numericValue: digitText,
    };
  }
  if (numericText !== "") {
    if (!/^(0|-?[1-9][0-9]*)(\/[1-9][0-9]*)?$/.test(numericText)) {
      throw new SyntaxError(`Invalid numeric value: ${numericText}`);
    }
    return {
      numericType: "Numeric",
      numericValue: numericText,
    };
  }
  return null;
}

function parseSingleCharacterMapping(mappingText: string): string | undefined {
  if (mappingText === "") {
    return undefined;
  }
  const s = parseCodePointString(mappingText);
  if ([...s].length /* take surrogates into account */ !== 1) {
    throw new SyntaxError(`Invalid mapping: ${mappingText} (length must be 1)`);
  }
  return s;
}
