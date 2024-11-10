import { assertEquals } from "$std/assert/mod.ts";
import { parseRow } from "./base.ts";

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
