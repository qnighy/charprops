import { getNNNN } from "../nnnn.ts";

// Constants from §3.12 Conjoining Jamo Behavior
const S_BASE = 0xAC00;
const L_COUNT = 19;
const V_COUNT = 21;
const T_COUNT = 28;
// HANGUL CHOSEONG KIYEOK - HANGUL CHOSEONG HIEUH (Jamo.txt)
const L_READINGS = [
  "G", "GG", "N", "D", "DD", "R", "M", "B", "BB", "S", "SS",
  "", "J", "JJ", "C", "K", "T", "P", "H"
];
// HANGUL JUNGSEONG A - HANGUL JUNGSEONG I (Jamo.txt)
const V_READINGS = [
  "A", "AE", "YA", "YAE", "EO", "E", "YEO", "YE", "O", "WA",
  "WAE", "OE", "YO", "U", "WEO", "WE", "WI", "YU", "EU", "YI", "I"
];
// Sentinel value at index 0,
// followed by HANGUL JONGSEONG KIYEOK - HANGUL JONGSEONG HIEUH (Jamo.txt)
const T_READINGS = [
  "", "G", "GG", "GS", "N", "NJ", "NH", "D", "L", "LG", "LM", "LB", "LS",
  "LT", "LP", "LH", "M", "B", "BS", "S", "SS", "NG", "J", "C", "K", "T", "P", "H"
];

/**
 * Computes the name of a codepoint from its label and codepoint.
 *
 * The rules themselves are based on §4.8 Name of the Unicode Standard.
 *
 * @param label 
 * @param codepoint 
 * @returns 
 */
export function deriveName(label: string, codepoint: number): string {
  const nnnn = getNNNN(codepoint);
  switch (label) {
    // U+0000 - U+001F and U+007F - U+009F
    case "control":
      return `<control-${nnnn}>`;

    // U+D800 - U+DB7F
    case "Non Private Use High Surrogate":
    // U+DB80 - U+DBFF
    case "Private Use High Surrogate":
    // U+DC00 - U+DFFF
    case "Low Surrogate":
      return `<surrogate-${nnnn}>`;

    // U+E000 - U+F8FF
    case "Private Use":
    // U+F0000 - U+FFFFD
    case "Plane 15 Private Use":
    // U+100000 - U+10FFFD
    case "Plane 16 Private Use":
      return `<private-use-${nnnn}>`;

    // U+AC00 - U+D7A3
    case "Hangul Syllable": {
      const sIndex = codepoint - S_BASE;
      if (sIndex < 0 || sIndex >= L_COUNT * V_COUNT * T_COUNT) {
        throw new Error(`Invalid Hangul syllable: ${getNNNN(codepoint)}`);
      }
      const lIndex = Math.floor(Math.floor(sIndex / T_COUNT) / V_COUNT);
      const vIndex = Math.floor(sIndex / T_COUNT) % V_COUNT;
      const tIndex = sIndex % T_COUNT;
      return `HANGUL SYLLABLE ${L_READINGS[lIndex]}${V_READINGS[vIndex]}${T_READINGS[tIndex]}`;
    }

    // U+3400 - U+4DBF
    case "CJK Ideograph Extension A":
    // U+4E00 - U+9FFF
    case "CJK Ideograph":
    // U+20000 - U+2A6DF
    case "CJK Ideograph Extension B":
    // U+2A700 - U+2B739
    case "CJK Ideograph Extension C":
    // U+2B740 - U+2B81D
    case "CJK Ideograph Extension D":
    // U+2B820 - U+2CEA1
    case "CJK Ideograph Extension E":
    // U+2CEB0 - U+2EBE0
    case "CJK Ideograph Extension F":
    // U+2EBF0 - U+2EE5D
    case "CJK Ideograph Extension I":
    // U+30000 - U+3134A
    case "CJK Ideograph Extension G":
    // U+31350 - U+323AF
    case "CJK Ideograph Extension H":
      return `CJK UNIFIED IDEOGRAPH-${nnnn}`

    // U+17000 - U+187F7
    case "Tangut Ideograph":
    // U+18D00 - U+18D08
    case "Tangut Ideograph Supplement":
      return `TANGUT IDEOGRAPH-${nnnn}`;
  }
  throw new Error(`Unknown label ${label} for codepoint ${nnnn}`);
}
