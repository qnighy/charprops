import { assertEquals } from "$std/assert/mod.ts";
import { deriveName } from "./name.ts";

Deno.test("deriveName: control", () => {
  assertEquals(deriveName("control", 0x0000), "<control-0000>");
  assertEquals(deriveName("control", 0x001F), "<control-001F>");
  assertEquals(deriveName("control", 0x007F), "<control-007F>");
  assertEquals(deriveName("control", 0x0080), "<control-0080>");
  assertEquals(deriveName("control", 0x009F), "<control-009F>");
});

Deno.test("deriveName: surrogate", () => {
  assertEquals(deriveName("Non Private Use High Surrogate", 0xD800), "<surrogate-D800>");
  assertEquals(deriveName("Non Private Use High Surrogate", 0xDB7F), "<surrogate-DB7F>");
  assertEquals(deriveName("Private Use High Surrogate", 0xDB80), "<surrogate-DB80>");
  assertEquals(deriveName("Private Use High Surrogate", 0xDBFF), "<surrogate-DBFF>");
  assertEquals(deriveName("Low Surrogate", 0xDC00), "<surrogate-DC00>");
  assertEquals(deriveName("Low Surrogate", 0xDFFF), "<surrogate-DFFF>");
});

Deno.test("deriveName: private use", () => {
  assertEquals(deriveName("Private Use", 0xE000), "<private-use-E000>");
  assertEquals(deriveName("Private Use", 0xF8FF), "<private-use-F8FF>");
  assertEquals(deriveName("Plane 15 Private Use", 0xF0000), "<private-use-F0000>");
  assertEquals(deriveName("Plane 15 Private Use", 0xFFFFD), "<private-use-FFFFD>");
  assertEquals(deriveName("Plane 16 Private Use", 0x100000), "<private-use-100000>");
  assertEquals(deriveName("Plane 16 Private Use", 0x10FFFD), "<private-use-10FFFD>");
});

Deno.test("deriveName: Hangul Syllable", () => {
  assertEquals(deriveName("Hangul Syllable", 0xAC00), "HANGUL SYLLABLE GA");
  assertEquals(deriveName("Hangul Syllable", 0xAC01), "HANGUL SYLLABLE GAG");
  assertEquals(deriveName("Hangul Syllable", 0xAC08), "HANGUL SYLLABLE GAL");
  assertEquals(deriveName("Hangul Syllable", 0xAC10), "HANGUL SYLLABLE GAM");
  assertEquals(deriveName("Hangul Syllable", 0xAC20), "HANGUL SYLLABLE GAEN");
  assertEquals(deriveName("Hangul Syllable", 0xAC40), "HANGUL SYLLABLE GYAL");
  assertEquals(deriveName("Hangul Syllable", 0xAC80), "HANGUL SYLLABLE GEOM");
  assertEquals(deriveName("Hangul Syllable", 0xAD00), "HANGUL SYLLABLE GWAN");
  assertEquals(deriveName("Hangul Syllable", 0xAE00), "HANGUL SYLLABLE GEUL");
  assertEquals(deriveName("Hangul Syllable", 0xAF00), "HANGUL SYLLABLE GGYEOLS");
  assertEquals(deriveName("Hangul Syllable", 0xB000), "HANGUL SYLLABLE GGWEM");
  assertEquals(deriveName("Hangul Syllable", 0xB100), "HANGUL SYLLABLE NYAESS");
  assertEquals(deriveName("Hangul Syllable", 0xB200), "HANGUL SYLLABLE NYOK");
  assertEquals(deriveName("Hangul Syllable", 0xB300), "HANGUL SYLLABLE DAE");
  assertEquals(deriveName("Hangul Syllable", 0xB400), "HANGUL SYLLABLE DWAEN");
  assertEquals(deriveName("Hangul Syllable", 0xB500), "HANGUL SYLLABLE DYIL");
  assertEquals(deriveName("Hangul Syllable", 0xB600), "HANGUL SYLLABLE DDYELS");
  assertEquals(deriveName("Hangul Syllable", 0xB700), "HANGUL SYLLABLE DDWIM");
  assertEquals(deriveName("Hangul Syllable", 0xB800), "HANGUL SYLLABLE REOSS");
  assertEquals(deriveName("Hangul Syllable", 0xB900), "HANGUL SYLLABLE RUK");
  assertEquals(deriveName("Hangul Syllable", 0xBA00), "HANGUL SYLLABLE MYA");
  assertEquals(deriveName("Hangul Syllable", 0xBB00), "HANGUL SYLLABLE MOEN");
  assertEquals(deriveName("Hangul Syllable", 0xD7A3), "HANGUL SYLLABLE HIH");
});

Deno.test("deriveName: CJK Ideograph", () => {
  assertEquals(deriveName("CJK Ideograph Extension A", 0x3400), "CJK UNIFIED IDEOGRAPH-3400");
  assertEquals(deriveName("CJK Ideograph Extension A", 0x4DBF), "CJK UNIFIED IDEOGRAPH-4DBF");
  assertEquals(deriveName("CJK Ideograph", 0x4E00), "CJK UNIFIED IDEOGRAPH-4E00");
  assertEquals(deriveName("CJK Ideograph", 0x9FFF), "CJK UNIFIED IDEOGRAPH-9FFF");
  assertEquals(deriveName("CJK Ideograph Extension B", 0x20000), "CJK UNIFIED IDEOGRAPH-20000");
  assertEquals(deriveName("CJK Ideograph Extension B", 0x2A6DF), "CJK UNIFIED IDEOGRAPH-2A6DF");
  assertEquals(deriveName("CJK Ideograph Extension C", 0x2A700), "CJK UNIFIED IDEOGRAPH-2A700");
  assertEquals(deriveName("CJK Ideograph Extension C", 0x2B739), "CJK UNIFIED IDEOGRAPH-2B739");
  assertEquals(deriveName("CJK Ideograph Extension D", 0x2B740), "CJK UNIFIED IDEOGRAPH-2B740");
  assertEquals(deriveName("CJK Ideograph Extension D", 0x2B81D), "CJK UNIFIED IDEOGRAPH-2B81D");
  assertEquals(deriveName("CJK Ideograph Extension E", 0x2B820), "CJK UNIFIED IDEOGRAPH-2B820");
  assertEquals(deriveName("CJK Ideograph Extension E", 0x2CEA1), "CJK UNIFIED IDEOGRAPH-2CEA1");
  assertEquals(deriveName("CJK Ideograph Extension F", 0x2CEB0), "CJK UNIFIED IDEOGRAPH-2CEB0");
  assertEquals(deriveName("CJK Ideograph Extension F", 0x2EBE0), "CJK UNIFIED IDEOGRAPH-2EBE0");
  assertEquals(deriveName("CJK Ideograph Extension I", 0x2EBF0), "CJK UNIFIED IDEOGRAPH-2EBF0");
  assertEquals(deriveName("CJK Ideograph Extension I", 0x2EE5D), "CJK UNIFIED IDEOGRAPH-2EE5D");
  assertEquals(deriveName("CJK Ideograph Extension G", 0x30000), "CJK UNIFIED IDEOGRAPH-30000");
  assertEquals(deriveName("CJK Ideograph Extension G", 0x3134A), "CJK UNIFIED IDEOGRAPH-3134A");
  assertEquals(deriveName("CJK Ideograph Extension H", 0x31350), "CJK UNIFIED IDEOGRAPH-31350");
  assertEquals(deriveName("CJK Ideograph Extension H", 0x323AF), "CJK UNIFIED IDEOGRAPH-323AF");
});

Deno.test("deriveName: Tangut Ideograph", () => {
  assertEquals(deriveName("Tangut Ideograph", 0x17000), "TANGUT IDEOGRAPH-17000");
  assertEquals(deriveName("Tangut Ideograph", 0x187F7), "TANGUT IDEOGRAPH-187F7");
  assertEquals(deriveName("Tangut Ideograph Supplement", 0x18D00), "TANGUT IDEOGRAPH-18D00");
  assertEquals(deriveName("Tangut Ideograph Supplement", 0x18D08), "TANGUT IDEOGRAPH-18D08");
});
