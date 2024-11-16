export function splitTag(tag: string): [string, string] {
  const eqIndex = tag.indexOf("=");
  return eqIndex === -1 ? [tag, ""] : [tag.slice(0, eqIndex), tag.slice(eqIndex + 1)];
}

export function normalizeTag(tag: string): string {
  const [tagPropertyName, tagPropertyValue] = splitTag(tag);

  const tagPropertyNameN = normalizeSymbolic(tagPropertyName);
  const normalizedPropertyName =
    Object.hasOwn(PROPERTY_ALIASES_N, tagPropertyNameN)
      ? PROPERTY_ALIASES_N[tagPropertyNameN]
      : tagPropertyName;

  // TODO: normalize values too

  return `${normalizedPropertyName}=${tagPropertyValue}`;
}

/**
 * Normalize a Unicode property name or a symbolic property value
 * according to UAX44-LM3.
 * @param s
 */
export function normalizeSymbolic(s: string): string {
  return s.toLowerCase().replace(/(?:^is(?=.)|[_ \-])/ig, "");
}

function keyNormalizedMap(mapping: Record<string, string>): Record<string, string> {
  const icasified: Record<string, string> = {};
  for (const [key, value] of Object.entries(mapping)) {
    icasified[normalizeSymbolic(key)] = value;
    const nValue = normalizeSymbolic(value);
    if (nValue !== value) {
      icasified[nValue] = value;
    }
  }
  return icasified;
}

// Source: PropertyAliases.txt
const PROPERTY_ALIASES: Record<string, string> = {
  // Numeric Properties
  kAccountingNumeric: "cjkAccountingNumeric",
  kOtherNumeric: "cjkOtherNumeric",
  kPrimaryNumeric: "cjkPrimaryNumeric",
  Numeric_Value: "nv",

  // String Properties
  Bidi_Mirroring_Glyph: "bmg",
  Bidi_Paired_Bracket: "bpb",
  Case_Folding: "cf",
  kCompatibilityVariant: "cjkCompatibilityVariant",
  Decomposition_Mapping: "dm",
  Equivalent_Unified_Ideograph: "EqUIdeo",
  FC_NFKC_Closure: "FC_NFKC",
  Lowercase_Mapping: "lc",
  NFKC_Casefold: "NFKC_CF",
  NFKC_Simple_Casefold: "NFKC_SCF",
  Simple_Case_Folding: "scf",
  sfc: "scf",
  Simple_Lowercase_Mapping: "slc",
  Simple_Titlecase_Mapping: "stc",
  Simple_Uppercase_Mapping: "suc",
  Titlecase_Mapping: "tc",
  Uppercase_Mapping: "uc",

  // Miscellaneous Properties
  kIICore: "cjkIICore",
  kIRG_GSource: "cjkIRG_GSource",
  kIRG_HSource: "cjkIRG_HSource",
  kIRG_JSource: "cjkIRG_JSource",
  kIRG_KPSource: "cjkIRG_KPSource",
  kIRG_KSource: "cjkIRG_KSource",
  kIRG_MSource: "cjkIRG_MSource",
  kIRG_SSource: "cjkIRG_SSource",
  kIRG_TSource: "cjkIRG_TSource",
  kIRG_UKSource: "cjkIRG_UKSource",
  kIRG_USource: "cjkIRG_USource",
  kIRG_VSource: "cjkIRG_VSource",
  kRSUnicode: "cjkRSUnicode",
  Unicode_Radical_Stroke: "cjkRSUnicode",
  URS: "cjkRSUnicode",
  ISO_Comment: "isc",
  Jamo_Short_Name: "JSN",
  kEH_Cat: "kEH_Cat",
  kEH_Desc: "kEH_Desc",
  kEH_HG: "kEH_HG",
  kEH_IFAO: "kEH_IFAO",
  kEH_JSesh: "kEH_JSesh",
  Name: "na",
  Unicode_1_Name: "na1",
  Name_Alias: "Name_Alias",
  Script_Extensions: "scx",

  // Catalog Properties
  Age: "age",
  Block: "blk",
  Script: "sc",

  // Enumerated Properties
  Bidi_Class: "bc",
  Bidi_Paired_Bracket_Type: "bpt",
  Canonical_Combining_Class: "ccc",
  Decomposition_Type: "dt",
  East_Asian_Width: "ea",
  General_Category: "gc",
  Grapheme_Cluster_Break: "GCB",
  Hangul_Syllable_Type: "hst",
  Indic_Conjunct_Break: "InCB",
  Indic_Positional_Category: "InPC",
  Indic_Syllabic_Category: "InSC",
  Joining_Group: "jg",
  Joining_Type: "jt",
  Line_Break: "lb",
  NFC_Quick_Check: "NFC_QC",
  NFD_Quick_Check: "NFD_QC",
  NFKC_Quick_Check: "NFKC_QC",
  NFKD_Quick_Check: "NFKD_QC",
  Numeric_Type: "nt",
  Sentence_Break: "SB",
  Vertical_Orientation: "vo",
  Word_Break: "WB",

  // Binary Properties
  ASCII_Hex_Digit: "AHex",
  Alphabetic: "Alpha",
  Bidi_Control: "Bidi_C",
  Bidi_Mirrored: "Bidi_M",
  Cased: "Cased",
  Composition_Exclusion: "CE",
  Case_Ignorable: "CI",
  Full_Composition_Exclusion: "Comp_Ex",
  Changes_When_Casefolded: "CWCF",
  Changes_When_Casemapped: "CWCM",
  Changes_When_NFKC_Casefolded: "CWKCF",
  Changes_When_Lowercased: "CWL",
  Changes_When_Titlecased: "CWT",
  Changes_When_Uppercased: "CWU",
  Dash: "Dash",
  Deprecated: "Dep",
  Default_Ignorable_Code_Point: "DI",
  Diacritic: "Dia",
  Emoji_Modifier_Base: "EBase",
  Emoji_Component: "EComp",
  Emoji_Modifier: "EMod",
  Emoji: "Emoji",
  Emoji_Presentation: "EPres",
  Extender: "Ext",
  Extended_Pictographic: "ExtPict",
  Grapheme_Base: "Gr_Base",
  Grapheme_Extend: "Gr_Ext",
  Grapheme_Link: "Gr_Link",
  Hex_Digit: "Hex",
  Hyphen: "Hyphen",
  ID_Compat_Math_Continue: "ID_Compat_Math_Continue",
  ID_Compat_Math_Start: "ID_Compat_Math_Start",
  ID_Continue: "IDC",
  Ideographic: "Ideo",
  ID_Start: "IDS",
  IDS_Binary_Operator: "IDSB",
  IDS_Trinary_Operator: "IDST",
  IDS_Unary_Operator: "IDSU",
  Join_Control: "Join_C",
  kEH_NoMirror: "kEH_NoMirror",
  kEH_NoRotate: "kEH_NoRotate",
  Logical_Order_Exception: "LOE",
  Lowercase: "Lower",
  Math: "Math",
  Modifier_Combining_Mark: "MCM",
  Noncharacter_Code_Point: "NChar",
  Other_Alphabetic: "OAlpha",
  Other_Default_Ignorable_Code_Point: "ODI",
  Other_Grapheme_Extend: "OGr_Ext",
  Other_ID_Continue: "OIDC",
  Other_ID_Start: "OIDS",
  Other_Lowercase: "OLower",
  Other_Math: "OMath",
  Other_Uppercase: "OUpper",
  Pattern_Syntax: "Pat_Syn",
  Pattern_White_Space: "Pat_WS",
  Prepended_Concatenation_Mark: "PCM",
  Quotation_Mark: "QMark",
  Radical: "Radical",
  Regional_Indicator: "RI",
  Soft_Dotted: "SD",
  Sentence_Terminal: "STerm",
  Terminal_Punctuation: "Term",
  Unified_Ideograph: "UIdeo",
  Uppercase: "Upper",
  Variation_Selector: "VS",
  White_Space: "WSpace",
  space: "WSpace",
  XID_Continue: "XIDC",
  XID_Start: "XIDS",
  Expands_On_NFC: "XO_NFC",
  Expands_On_NFD: "XO_NFD",
  Expands_On_NFKC: "XO_NFKC",
  Expands_On_NFKD: "XO_NFKD",
};

const PROPERTY_ALIASES_N = keyNormalizedMap(PROPERTY_ALIASES);
