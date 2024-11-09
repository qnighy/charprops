import { assertEquals, assertThrows } from "$std/assert/mod.ts";
import { CodePointData, CodePointRange, DerivableNameData, parseCodePoint, parseCodePointOrRange, parseName, RangeIdentifierEndData, RangeIdentifierStartData, RegularNameData } from "./parser.ts";

Deno.test("parseCodePoint: valid code points", () => {
  assertEquals(parseCodePoint("0000"), 0x0000);
  assertEquals(parseCodePoint("1234"), 0x1234);
  assertEquals(parseCodePoint("FFFF"), 0xFFFF);
  assertEquals(parseCodePoint("10000"), 0x10000);
  assertEquals(parseCodePoint("10FFFF"), 0x10FFFF);
  // also surrogates
  assertEquals(parseCodePoint("D800"), 0xD800);
  assertEquals(parseCodePoint("DBFF"), 0xDBFF);
});

Deno.test("parseCodePoint: invalid code points", () => {
  assertThrows(() => parseCodePoint("000"), SyntaxError, "Invalid code point: 000");
  assertThrows(() => parseCodePoint("G000"), SyntaxError, "Invalid code point: G000");
});
Deno.test("parseCodePointOrRange: single code points", () => {
  assertEquals(parseCodePointOrRange("12345"), CodePointData(0x12345));
});

Deno.test("parseCodePointOrRange: code point ranges", () => {
  assertEquals(parseCodePointOrRange("12345..12347"), CodePointRange(0x12345, 0x12347));
});

Deno.test("parseName: regular names", () => {
  assertEquals(parseName("LATIN CAPITAL LETTER A"), RegularNameData("LATIN CAPITAL LETTER A"));
});

Deno.test("parseName: derivable names", () => {
  assertEquals(parseName("<control>"), DerivableNameData("control"));
});

Deno.test("parseName: range start", () => {
  assertEquals(parseName("<CJK Ideograph, First>"), RangeIdentifierStartData("CJK Ideograph"));
});

Deno.test("parseName: range end", () => {
  assertEquals(parseName("<CJK Ideograph, Last>"), RangeIdentifierEndData("CJK Ideograph"));
});
