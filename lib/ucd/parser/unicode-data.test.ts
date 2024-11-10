import { assertEquals } from "$std/assert/mod.ts";
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
        name: RegularNameData("LATIN CAPITAL LETTER A")
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
        name: DerivableNameData("CJK Ideograph")
      }
    ]
  );
});
