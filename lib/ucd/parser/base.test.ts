import { assertEquals } from "$std/assert/mod.ts";
import { parseRow, parseRows } from "./base.ts";

Deno.test("parseRow: empty", () => {
  assertEquals(parseRow(""), null);
  assertEquals(parseRow(" "), null);
  assertEquals(parseRow("# foo"), null);
  assertEquals(parseRow(" # foo "), null);
});

Deno.test("parseRow: non-emtpy", () => {
  assertEquals(parseRow("foo"), ["foo"]);
  assertEquals(parseRow("foo ; bar # baz #;#;"), ["foo", "bar"]);
  assertEquals(parseRow(";;"), ["", "", ""]);
});

async function collectAsync<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iter) {
    result.push(item);
  }
  return result;
}

Deno.test("rows", async () => {
  assertEquals(await collectAsync(parseRows(["foo; bar", "", "baz; baz #"])), [["foo", "bar"], ["baz", "baz"]]);
});
