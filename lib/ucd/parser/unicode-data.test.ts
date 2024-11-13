import { assertEquals } from "@std/assert";
import { CodePointData, CodePointRange } from "./codepoint.ts";
import { DerivableNameData, RegularNameData } from "./name.ts";
import { parseUnicodeData } from "./unicode-data.ts";

async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iter) {
    result.push(item);
  }
  return result;
}

Deno.test("parseUnicodeData: parse ordinary row", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData(["0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;\n"])),
    [
      {
        codepoint: CodePointData(0x0041),
        name: RegularNameData("LATIN CAPITAL LETTER A"),
        generalCategory: "Lu",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: null,
        numeric: null,
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: "a",
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse range", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "4E00;<CJK Ideograph, First>;Lo;0;L;;;;;N;;;;;\n",
      "9FFF;<CJK Ideograph, Last>;Lo;0;L;;;;;N;;;;;\n",
    ])),
    [
      {
        codepoint: CodePointRange(0x4E00, 0x9FFF),
        name: DerivableNameData("CJK Ideograph"),
        generalCategory: "Lo",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: null,
        numeric: null,
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: undefined,
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse compat mapping", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "00A8;DIAERESIS;Sk;0;ON;<compat> 0020 0308;;;;N;SPACING DIAERESIS;;;;\n",
    ])),
    [
      {
        codepoint: CodePointData(0x00A8),
        name: RegularNameData("DIAERESIS"),
        generalCategory: "Sk",
        canonicalCombiningClass: 0,
        bidiClass: "ON",
        decomposition: {
          decompositionType: "Compat",
          decompositionMapping: "\u0020\u0308",
        },
        numeric: null,
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: undefined,
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse canonical mapping", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "00C0;LATIN CAPITAL LETTER A WITH GRAVE;Lu;0;L;0041 0300;;;;N;LATIN CAPITAL LETTER A GRAVE;;;00E0;\n",
    ])),
    [
      {
        codepoint: CodePointData(0x00C0),
        name: RegularNameData("LATIN CAPITAL LETTER A WITH GRAVE"),
        generalCategory: "Lu",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: {
          decompositionType: "Canonical",
          decompositionMapping: "\u0041\u0300",
        },
        numeric: null,
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: "\u00E0",
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse decimal numeric type", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "0030;DIGIT ZERO;Nd;0;EN;;0;0;0;N;;;;;\n",
    ])),
    [
      {
        codepoint: CodePointData(0x0030),
        name: RegularNameData("DIGIT ZERO"),
        generalCategory: "Nd",
        canonicalCombiningClass: 0,
        bidiClass: "EN",
        decomposition: null,
        numeric: {
          numericType: "Decimal",
          numericValue: "0",
        },
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: undefined,
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse digit numeric type", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "1369;ETHIOPIC DIGIT ONE;No;0;L;;;1;1;N;;;;;\n",
    ])),
    [
      {
        codepoint: CodePointData(0x1369),
        name: RegularNameData("ETHIOPIC DIGIT ONE"),
        generalCategory: "No",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: null,
        numeric: {
          numericType: "Digit",
          numericValue: "1",
        },
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: undefined,
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse numeric numeric type", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "2160;ROMAN NUMERAL ONE;Nl;0;L;<compat> 0049;;;1;N;;;;2170;\n",
    ])),
    [
      {
        codepoint: CodePointData(0x2160),
        name: RegularNameData("ROMAN NUMERAL ONE"),
        generalCategory: "Nl",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: {
          decompositionType: "Compat",
          decompositionMapping: "\u0049",
        },
        numeric: {
          numericType: "Numeric",
          numericValue: "1",
        },
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: "\u2170",
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse Bidi_Mirrored=Y", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "0028;LEFT PARENTHESIS;Ps;0;ON;;;;;Y;OPENING PARENTHESIS;;;;\n",
    ])),
    [
      {
        codepoint: CodePointData(0x0028),
        name: RegularNameData("LEFT PARENTHESIS"),
        generalCategory: "Ps",
        canonicalCombiningClass: 0,
        bidiClass: "ON",
        decomposition: null,
        numeric: null,
        bidiMirrored: true,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: undefined,
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse Simple_Uppercase_Mapping", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "0061;LATIN SMALL LETTER A;Ll;0;L;;;;;N;;;0041;;0041\n",
    ])),
    [
      {
        codepoint: CodePointData(0x0061),
        name: RegularNameData("LATIN SMALL LETTER A"),
        generalCategory: "Ll",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: null,
        numeric: null,
        bidiMirrored: false,
        simpleUppercaseMapping: "\u0041",
        simpleLowercaseMapping: undefined,
        simpleTitlecaseMapping: "\u0041",
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse Simple_Lowercase_Mapping", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "0041;LATIN CAPITAL LETTER A;Lu;0;L;;;;;N;;;;0061;\n",
    ])),
    [
      {
        codepoint: CodePointData(0x0041),
        name: RegularNameData("LATIN CAPITAL LETTER A"),
        generalCategory: "Lu",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: null,
        numeric: null,
        bidiMirrored: false,
        simpleUppercaseMapping: undefined,
        simpleLowercaseMapping: "a",
        simpleTitlecaseMapping: undefined,
      }
    ]
  );
});

Deno.test("parseUnicodeData: parse Simple_Titlecase_Mapping", async () => {
  assertEquals(
    await collectAsync(parseUnicodeData([
      "0061;LATIN SMALL LETTER A;Ll;0;L;;;;;N;;;0041;;0041\n",
    ])),
    [
      {
        codepoint: CodePointData(0x0061),
        name: RegularNameData("LATIN SMALL LETTER A"),
        generalCategory: "Ll",
        canonicalCombiningClass: 0,
        bidiClass: "L",
        decomposition: null,
        numeric: null,
        bidiMirrored: false,
        simpleUppercaseMapping: "\u0041",
        simpleLowercaseMapping: undefined,
        simpleTitlecaseMapping: "\u0041",
      }
    ]
  );
});
