import { assertEquals } from "@std/assert";
import { stringifyCodePoint } from "./codepoint.ts";
import { parseCodePoint, UnicodeCodePoint } from "./codepoint.ts";

Deno.test("parseCodePoint", () => {
  assertEquals(parseCodePoint("u+41"), UnicodeCodePoint(0x41));
  assertEquals(parseCodePoint("u+fe"), UnicodeCodePoint(0xfe));
  assertEquals(parseCodePoint("u+fE"), UnicodeCodePoint(0xfe));
  assertEquals(parseCodePoint("u+001234"), UnicodeCodePoint(0x1234));
  assertEquals(parseCodePoint("u+10ffff"), UnicodeCodePoint(0x10ffff));
  assertEquals(parseCodePoint("u+110000"), null);
  assertEquals(parseCodePoint("u+"), null);
  assertEquals(parseCodePoint("u+0"), UnicodeCodePoint(0));
  assertEquals(parseCodePoint("u+00"), UnicodeCodePoint(0));
  assertEquals(parseCodePoint("u+000"), UnicodeCodePoint(0));
  assertEquals(parseCodePoint("u+0000"), UnicodeCodePoint(0));
  assertEquals(parseCodePoint("u+00000"), UnicodeCodePoint(0));
  assertEquals(parseCodePoint("u+000000"), UnicodeCodePoint(0));
  assertEquals(parseCodePoint("u+0000000"), UnicodeCodePoint(0));
  assertEquals(parseCodePoint("u+00000000"), UnicodeCodePoint(0));
  // Surrogates
  assertEquals(parseCodePoint("u+d800"), UnicodeCodePoint(0xd800));
  assertEquals(parseCodePoint("u+dfff"), UnicodeCodePoint(0xdfff));
});

Deno.test("stringifyCodePoint", () => {
  assertEquals(stringifyCodePoint(UnicodeCodePoint(0x41)), "U+0041");
  assertEquals(stringifyCodePoint(UnicodeCodePoint(0xfe)), "U+00FE");
  assertEquals(stringifyCodePoint(UnicodeCodePoint(0x1234)), "U+1234");
  assertEquals(stringifyCodePoint(UnicodeCodePoint(0x10ffff)), "U+10FFFF");
  // Surrogates
  assertEquals(stringifyCodePoint(UnicodeCodePoint(0xd800)), "U+D800");
  assertEquals(stringifyCodePoint(UnicodeCodePoint(0xdfff)), "U+DFFF");
});
