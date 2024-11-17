import { assertEquals } from "@std/assert";
import { createMessageType, decodeProtobuf, encodeProtobuf, Int32Type, Int64Type, RequiredField } from "./minibuf.ts";

const TestMessage1 = createMessageType("TestMessage1", [
  new RequiredField("field1", Int64Type, 1),
  new RequiredField("field2", Int32Type, 2),
]);

Deno.test("TestMessage1 encoding", () => {
  const message = new TestMessage1({ field1: 1234567890123456n, field2: 1234567890 });
  const encoded = encodeProtobuf(message, TestMessage1);
  const expected = new Uint8Array([
    0x08, 0xc0, 0xf5, 0xaa, 0xe4, 0xd3, 0xda, 0x98, 0x02, 0x10, 0xd2, 0x85, 0xd8, 0xcc, 0x04,
  ]);
  assertEquals(encoded, expected);
});

Deno.test("TestMessage1 decoding", () => {
  const encoded = new Uint8Array([
    0x08, 0xc0, 0xf5, 0xaa, 0xe4, 0xd3, 0xda, 0x98, 0x02, 0x10, 0xd2, 0x85, 0xd8, 0xcc, 0x04,
  ]);
  const message = decodeProtobuf(encoded, TestMessage1);
  assertEquals(message.field1, 1234567890123456n);
  assertEquals(message.field2, 1234567890);
});
