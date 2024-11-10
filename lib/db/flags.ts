import { BidiClass, DecompositionType, GeneralCategoryAbbr, NumericType } from "../ucd/parser.ts";
import { BitStruct, BooleanBitField, EnumBitField, NumericBitField } from "./flags-util.ts";

export type Flags = {
  flags1: number;
};

export type ExpandedFlags = {
  generalCategory: GeneralCategoryAbbr;
  canonicalCombiningClass: number;
  bidiClass: BidiClass;
  decompositionType: DecompositionType | undefined;
  numericType: NumericType | undefined;
  bidiMirrored: boolean;
};

const GENERAL_CATEGORIES: GeneralCategoryAbbr[] = [
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
];

const BIDI_CLASSES: BidiClass[] = [
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
]

const DECOMPOSITION_TYPES: (DecompositionType | undefined)[] = [
  undefined,
  "Canonical",
  "Font",
  "NoBreak",
  "Initial",
  "Medial",
  "Final",
  "Isolated",
  "Circle",
  "Super",
  "Sub",
  "Vertical",
  "Wide",
  "Narrow",
  "Small",
  "Square",
  "Fraction",
  "Compat",
];

const NUMERIC_TYPES: (NumericType | undefined)[] = [
  undefined,
  "Decimal",
  "Digit",
  "Numeric",
];

const Flag1Descriptor = new BitStruct<ExpandedFlags>({
  // One of 30 values
  generalCategory: new EnumBitField(GENERAL_CATEGORIES, 5),
  canonicalCombiningClass: new NumericBitField(240, 8),
  // One of 23 values
  bidiClass: new EnumBitField(BIDI_CLASSES, 5),
  // One of 18 (= 17 + 1) values
  decompositionType: new EnumBitField(DECOMPOSITION_TYPES, 5),
  // One of 4 (= 3 + 1) values
  numericType: new EnumBitField(NUMERIC_TYPES, 2),
  bidiMirrored: new BooleanBitField(),
});

export function compressFlags(flags: ExpandedFlags): Flags {
  return {
    flags1: Flag1Descriptor.encode(flags),
  };
}

export function expandFlags(flags: Flags): ExpandedFlags {
  return Flag1Descriptor.decode(flags.flags1);
}