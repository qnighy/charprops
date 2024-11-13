import { assertEquals, assertThrows } from "@std/assert";
import { CodePointData, CodePointRange, parseCodePoint, parseCodePointOrRange } from "./codepoint.ts";

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
