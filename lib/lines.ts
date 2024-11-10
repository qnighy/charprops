const CR = 13;
const LF = 10;
const DEFAULT_INITIAL_BUFFER_SIZE = 1024;

export type LinesOptions = {
  initialBufferSize?: number;
};

export async function* lines(stream: ReadableStream, options: LinesOptions = {}): AsyncGenerator<string> {
  const { initialBufferSize = DEFAULT_INITIAL_BUFFER_SIZE } = options;
  let buffer = new ArrayBuffer(initialBufferSize);
  let bufStart = 0;
  let bufEnd = 0;
  const reader = stream.getReader({ mode: 'byob' });
  try {
    while (true) {
      const scanStart = bufEnd;
      const { value: readValue, done } = await reader.read(new Uint8Array(buffer, bufEnd));
      reader.cancel
      if (!readValue) {
        // Read was cancelled and the buffer was detached
        break;
      }
      buffer = readValue.buffer;
      bufEnd += readValue.byteLength;
      const view = new Uint8Array(buffer);
      for (let i = scanStart; i < bufEnd; i++) {
        if (
          view[i] === LF ||
          (i + 1 < bufEnd && view[i] === CR && view[i + 1] !== LF)
        ) {
          yield new TextDecoder().decode(view.subarray(bufStart, i + 1));
          bufStart = i + 1;
        }
      }
      if (done) {
        if (bufStart < bufEnd) {
          yield new TextDecoder().decode(view.subarray(bufStart, bufEnd));
        }
        break;
      }
      if (bufEnd === buffer.byteLength) {
        if (bufStart > 0) {
          view.copyWithin(0, bufStart, bufEnd);
          bufEnd -= bufStart;
          bufStart = 0;
        } else {
          const newBuffer = new ArrayBuffer(buffer.byteLength * 2);
          new Uint8Array(newBuffer).set(view);
          buffer = newBuffer;
        }
      }
    }
  } finally {
    await reader.cancel();
  }
}
