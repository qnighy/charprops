import { assertEquals } from "$std/assert/mod.ts";
import { DerivableNameData, parseName, RangeIdentifierEndData, RangeIdentifierStartData, RegularNameData } from "./name.ts";

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
