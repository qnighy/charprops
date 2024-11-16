import { assertEquals } from "@std/assert";
import { parseCodepoint, stringifyCodepoint, UnicodeCodepoint } from "./codepoint.ts";

Deno.test("parseCodepoint", () => {
  assertEquals(parseCodepoint("u+41"), UnicodeCodepoint(0x41));
  assertEquals(parseCodepoint("u+fe"), UnicodeCodepoint(0xfe));
  assertEquals(parseCodepoint("u+fE"), UnicodeCodepoint(0xfe));
  assertEquals(parseCodepoint("u+001234"), UnicodeCodepoint(0x1234));
  assertEquals(parseCodepoint("u+10ffff"), UnicodeCodepoint(0x10ffff));
  assertEquals(parseCodepoint("u+110000"), null);
  assertEquals(parseCodepoint("u+"), null);
  assertEquals(parseCodepoint("u+0"), UnicodeCodepoint(0));
  assertEquals(parseCodepoint("u+00"), UnicodeCodepoint(0));
  assertEquals(parseCodepoint("u+000"), UnicodeCodepoint(0));
  assertEquals(parseCodepoint("u+0000"), UnicodeCodepoint(0));
  assertEquals(parseCodepoint("u+00000"), UnicodeCodepoint(0));
  assertEquals(parseCodepoint("u+000000"), UnicodeCodepoint(0));
  assertEquals(parseCodepoint("u+0000000"), UnicodeCodepoint(0));
  assertEquals(parseCodepoint("u+00000000"), UnicodeCodepoint(0));
  // Surrogates
  assertEquals(parseCodepoint("u+d800"), UnicodeCodepoint(0xd800));
  assertEquals(parseCodepoint("u+dfff"), UnicodeCodepoint(0xdfff));
});

Deno.test("stringifyCodepoint", () => {
  assertEquals(stringifyCodepoint(UnicodeCodepoint(0x41)), "U+0041");
  assertEquals(stringifyCodepoint(UnicodeCodepoint(0xfe)), "U+00FE");
  assertEquals(stringifyCodepoint(UnicodeCodepoint(0x1234)), "U+1234");
  assertEquals(stringifyCodepoint(UnicodeCodepoint(0x10ffff)), "U+10FFFF");
  // Surrogates
  assertEquals(stringifyCodepoint(UnicodeCodepoint(0xd800)), "U+D800");
  assertEquals(stringifyCodepoint(UnicodeCodepoint(0xdfff)), "U+DFFF");
});
