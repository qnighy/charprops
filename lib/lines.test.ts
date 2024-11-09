import { lines } from "./lines.ts";
import { delay } from "$std/async/mod.ts";
import { assertEquals } from "$std/assert/mod.ts";

function chunkedStream(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    type: "bytes",
    async start(controller) {
      for (const chunk of chunks) {
        await delay(0);
        controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk);
      }
      controller.close();
    },
  });
}

Deno.test("lines: long chunks, short lines", async () => {
  const stream = chunkedStream([
    "a1\na2\na3\na4\na5\na6\na7\na8\na9\na10\na1",
    "1\na12\na13\na14\na15\na16\na17\na18\na19\na20\n",
  ]);
  const expectLines = [
    "a1\n",
    "a2\n",
    "a3\n",
    "a4\n",
    "a5\n",
    "a6\n",
    "a7\n",
    "a8\n",
    "a9\n",
    "a10\n",
    "a11\n",
    "a12\n",
    "a13\n",
    "a14\n",
    "a15\n",
    "a16\n",
    "a17\n",
    "a18\n",
    "a19\n",
    "a20\n",
  ];
  const result: string[] = [];
  for await (const line of lines(stream, { initialBufferSize: 8 })) {
    result.push(line);
  }
  assertEquals(result, expectLines);
});

Deno.test("lines: short chunks, short lines", async () => {
  const stream = chunkedStream([
    "a",
    "1",
    "\n",
    "a",
    "2",
    "\n",
    "a",
    "3",
    "\n",
    "a",
    "4",
    "\n",
    "a",
    "5",
    "\n",
    "a",
    "6",
    "\n",
    "a",
    "7",
    "\n",
    "a",
    "8",
    "\n",
    "a",
    "9",
    "\n",
    "a",
    "10",
    "\n",
    "a",
    "1",
    "1",
    "\n",
    "a",
    "12",
    "\n",
    "a",
    "1",
    "3",
    "\n",
    "a",
    "14",
    "\n",
    "a",
    "1",
    "5",
    "\n",
    "a",
    "16",
    "\n",
    "a",
    "1",
    "7",
    "\n",
    "a",
    "18",
    "\n",
    "a",
    "1",
    "9",
    "\n",
    "a",
    "20",
    "\n",
  ]);
  const expectLines = [
    "a1\n",
    "a2\n",
    "a3\n",
    "a4\n",
    "a5\n",
    "a6\n",
    "a7\n",
    "a8\n",
    "a9\n",
    "a10\n",
    "a11\n",
    "a12\n",
    "a13\n",
    "a14\n",
    "a15\n",
    "a16\n",
    "a17\n",
    "a18\n",
    "a19\n",
    "a20\n",
  ];
  const result: string[] = [];
  for await (const line of lines(stream, { initialBufferSize: 8 })) {
    result.push(line);
  }
  assertEquals(result, expectLines);
});

Deno.test("lines: long chunks, long lines", async () => {
  const stream = chunkedStream([
    "a1, a2, a3, a4, a5, a6, a7, a8, ",
    "a9, a10\na11, a12, a13, a14, a15, a16, a17, a18, a19, a20\n",
  ]);
  const expectLines = [
    "a1, a2, a3, a4, a5, a6, a7, a8, a9, a10\n",
    "a11, a12, a13, a14, a15, a16, a17, a18, a19, a20\n",
  ];
  const result: string[] = [];
  for await (const line of lines(stream, { initialBufferSize: 8 })) {
    result.push(line);
  }
  assertEquals(result, expectLines);
});

Deno.test("lines: short chunks, long lines", async () => {
  const stream = chunkedStream([
    "a",
    "1",
    ",",
    " ",
    "a",
    "2",
    ",",
    " ",
    "a",
    "3",
    ",",
    " ",
    "a",
    "4",
    ",",
    " ",
    "a",
    "5",
    ",",
    " ",
    "a",
    "6",
    ",",
    " ",
    "a",
    "7",
    ",",
    " ",
    "a",
    "8",
    ",",
    " ",
    "a",
    "9",
    ",",
    " ",
    "a",
    "1",
    "0",
    "\n",
    "a",
    "1",
    "1",
    ",",
    " ",
    "a",
    "12",
    ",",
    " ",
    "a",
    "1",
    "3",
    ",",
    " ",
    "a",
    "14",
    ",",
    " ",
    "a",
    "1",
    "5",
    ",",
    " ",
    "a",
    "16",
    ",",
    " ",
    "a",
    "1",
    "7",
    ",",
    " ",
    "a",
    "18",
    ",",
    " ",
    "a",
    "1",
    "9",
    ",",
    " ",
    "a",
    "20",
    "\n",
  ]);
  const expectLines = [
    "a1, a2, a3, a4, a5, a6, a7, a8, a9, a10\n",
    "a11, a12, a13, a14, a15, a16, a17, a18, a19, a20\n",
  ];
  const result: string[] = [];
  for await (const line of lines(stream, { initialBufferSize: 8 })) {
    result.push(line);
  }
  assertEquals(result, expectLines);
});

Deno.test("lines: eol codes", async () => {
  const stream = chunkedStream([
    "a1\r\na2\na3\ra4\na5\ra6\na7\ra8\na9\na10\n",
  ]);
  const expectLines = [
    "a1\r\n",
    "a2\n",
    "a3\r",
    "a4\n",
    "a5\r",
    "a6\n",
    "a7\r",
    "a8\n",
    "a9\n",
    "a10\n",
  ];
  const result: string[] = [];
  for await (const line of lines(stream, { initialBufferSize: 8 })) {
    result.push(line);
  }
  assertEquals(result, expectLines);
});

Deno.test("lines: last line without eol code", async () => {
  const stream = chunkedStream([
    "a1\na2\na3\na4\na5\na6\na7\na8\na9\na10",
  ]);
  const expectLines = [
    "a1\n",
    "a2\n",
    "a3\n",
    "a4\n",
    "a5\n",
    "a6\n",
    "a7\n",
    "a8\n",
    "a9\n",
    "a10",
  ];
  const result: string[] = [];
  for await (const line of lines(stream, { initialBufferSize: 8 })) {
    result.push(line);
  }
  assertEquals(result, expectLines);
});
