import { assertEquals, assertThrows } from "@std/assert";
import { CodepointData, CodepointRange, parseCodepoint, parseCodepointOrRange } from "./codepoint.ts";

Deno.test("parseCodepoint: valid code points", () => {
  assertEquals(parseCodepoint("0000"), 0x0000);
  assertEquals(parseCodepoint("1234"), 0x1234);
  assertEquals(parseCodepoint("FFFF"), 0xFFFF);
  assertEquals(parseCodepoint("10000"), 0x10000);
  assertEquals(parseCodepoint("10FFFF"), 0x10FFFF);
  // also surrogates
  assertEquals(parseCodepoint("D800"), 0xD800);
  assertEquals(parseCodepoint("DBFF"), 0xDBFF);
});

Deno.test("parseCodepoint: invalid code points", () => {
  assertThrows(() => parseCodepoint("000"), SyntaxError, "Invalid code point: 000");
  assertThrows(() => parseCodepoint("G000"), SyntaxError, "Invalid code point: G000");
});
Deno.test("parseCodepointOrRange: single code points", () => {
  assertEquals(parseCodepointOrRange("12345"), CodepointData(0x12345));
});

Deno.test("parseCodepointOrRange: code point ranges", () => {
  assertEquals(parseCodepointOrRange("12345..12347"), CodepointRange(0x12345, 0x12347));
});
