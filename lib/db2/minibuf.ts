export type TYPE_VARINT = 0;
export type TYPE_I64 = 1;
export type TYPE_LEN = 2;
export type TYPE_SGROUP = 3;
export type TYPE_EGROUP = 4;
export type TYPE_I32 = 5;
export const TYPE_VARINT: TYPE_VARINT = 0;
export const TYPE_I64: TYPE_I64 = 1;
export const TYPE_LEN: TYPE_LEN = 2;
export const TYPE_SGROUP: TYPE_SGROUP = 3;
export const TYPE_EGROUP: TYPE_EGROUP = 4;
export const TYPE_I32: TYPE_I32 = 5;

/**
 * This field is one of int64, uint64, and sint64.
 */
export const READ_FLAG_VARINT64 = 1;
/**
 * This field is one of fixed32, sfixed32, fixed64, and sfixed64.
 */
export const READ_FLAG_FIXED_INT = 1;
/**
 * This field is one of fixed32, sfixed32, and float.
 * 
 * Only relevant if READ_FLAG_PACKABLE is set.
 */
export const READ_FLAG_I32 = 2;
/**
 * This field is one of fixed64, sfixed64, and double.
 * 
 * Only relevant if READ_FLAG_PACKABLE is set.
 */
export const READ_FLAG_I64 = 4;
/**
 * This field allows packed encoding,
 * i.e. the field is a repeated field and the element type is a scalar
 * other than bytes and string.
 */
export const READ_FLAG_PACKABLE = 8;
export type MessageReader<M> = {
  getFieldReader(fieldNumber: number): FieldReader<M> | undefined;
};
export type FieldReader<M> = {
  readonly fieldFlags: number;
  /**
   * Set or append a field value.
   *
   * For VARINT field, `value` is a number unless `READ_FLAG_VARINT64` is set.
   * If the flag is set, `value` is a bigint.
   *
   * For I32 field, `value` is always a number.
   *
   * For I64 field, `value` is a number unless `READ_FLAG_FIXED_INT` is set.
   * If the flag is set, `value` is a bigint.
   *
   * For LEN field, `value` is a Uint8Array.
   */
  setField(obj: M, fieldType: number, value: bigint | number | Uint8Array): void;
  /**
   * Set up a proto2 group for reading.
   */
  // deno-lint-ignore no-explicit-any
  setGroup?(obj: M): [subObj: any, subReader: MessageReader<any>] | undefined
};

export function decodeProtobuf<M>(buf: Uint8Array, msgType: MessageType<M>): M {
  const obj = new msgType();
  decodeProtobufTo(buf, obj, msgType);
  return obj;
}

export function decodeProtobufTo<M>(buf: Uint8Array, obj: M, reader: MessageReader<M>) {
  const decoder = new MessageDecoder(buf);
  decoder.readMessage(obj, reader);
}

class MessageDecoder {
  #buf: Uint8Array;
  #bufView: DataView;
  #pos = 0;

  constructor(buf: Uint8Array) {
    if (buf.length > 0x7FFFFFFF) {
      throw new SyntaxError("Proto too large (2 GiB limit)");
    }
    this.#buf = buf;
    this.#bufView = new DataView(buf.buffer);
  }

  readMessage<M>(obj: M, reader: MessageReader<M>, expectEGroup?: number) {
    while (this.#pos < this.#buf.length) {
      const tag = this.#readVarint32();
      if (tag >= 2 ** 32) {
        throw new SyntaxError("Field number is too large");
      }
      // field number is at most (1 << 29) - 1 and representable as a number
      const fieldNumber = tag >>> 3;
      if (fieldNumber === 0) {
        throw new SyntaxError("Field number zero is invalid");
      }
      const wireType = tag & 0x7;
      if (wireType === TYPE_EGROUP) {
        if (fieldNumber === expectEGroup) {
          return;
        } else {
          throw new SyntaxError("Non-matching EGROUP");
        }
      }
      const fieldReader = reader.getFieldReader(fieldNumber);
      if (fieldReader == null) {
        this.#skipFieldValue(fieldNumber, wireType);
        continue;
      }
      if (wireType === TYPE_LEN) {
        if (fieldReader.fieldFlags & READ_FLAG_PACKABLE) {
          this.#readPackedField(obj, fieldReader);
          continue;
        }
      }
      this.#readFieldValue(obj, fieldReader, wireType);
    }
    if (expectEGroup != null) {
      throw new SyntaxError("Unterminated SGROUP");
    }
  }

  #readPackedField<M>(obj: M, fieldReader: FieldReader<M>) {
    const wireType =
      fieldReader.fieldFlags & READ_FLAG_I32 ? TYPE_I32 :
      fieldReader.fieldFlags & READ_FLAG_I64 ? TYPE_I64 :
      TYPE_VARINT;
    const length = this.#readVarint32();
    const end = this.#pos + length;
    if (end > this.#buf.length) {
      throw new SyntaxError("Unexpected end of buffer");
    }
    while (this.#pos < end) {
      this.#readFieldValue(obj, fieldReader, wireType);
    }
    if (this.#pos !== end) {
      throw new SyntaxError("Overflow detected in packed field");
    }
  }

  #readFieldValue<M>(obj: M, fieldReader: FieldReader<M>, wireType: number) {
    let wireValue: bigint | number | Uint8Array;
    switch (wireType) {
      case TYPE_VARINT:
        if (fieldReader.fieldFlags & READ_FLAG_VARINT64) {
          wireValue = this.#readVarint64();
        } else {
          wireValue = this.#readVarint32();
        }
        break;
      case TYPE_I64:
        if (fieldReader.fieldFlags & READ_FLAG_FIXED_INT) {
          wireValue = this.#bufView.getBigUint64(this.#pos, true);
        } else {
          wireValue = this.#bufView.getFloat64(this.#pos, true);
        }
        this.#pos += 8;
        break;
      case TYPE_LEN:
        wireValue = this.#readLEN();
        break;
      case TYPE_SGROUP: {
        const groupResp = fieldReader.setGroup?.(obj);
        if (groupResp == null) {
          throw new SyntaxError("Unexpected SGROUP");
        }
        const [subObj, subReader] = groupResp;
        this.readMessage(subObj, subReader, fieldReader.fieldFlags);
        return;
      }
      case TYPE_I32:
        if (fieldReader.fieldFlags & READ_FLAG_FIXED_INT) {
          wireValue = this.#bufView.getUint32(this.#pos, true);
        } else {
          wireValue = this.#bufView.getFloat32(this.#pos, true);
        }
        break;
      default:
        throw new SyntaxError(`Unexpected wire type ${wireType}`);
    }
    fieldReader.setField(obj, wireType, wireValue);
  }

  #skipFieldValue(fieldNumber: number, wireType: number) {
    switch (wireType) {
      case TYPE_VARINT:
        this.#readVarint32();
        break;
      case TYPE_I64:
        this.#pos += 8;
        break;
      case TYPE_LEN: {
        const length = this.#readVarint32();
        if (this.#pos + length > this.#buf.length) {
          throw new SyntaxError("Unexpected end of buffer");
        }
        this.#pos += length;
        break;
      }
      case TYPE_SGROUP:
        while (true) {
          const tag = this.#readVarint32();
          const innerFieldNumber = tag >>> 3;
          const wireType = tag & 0x7;
          if (wireType === TYPE_EGROUP) {
            if (innerFieldNumber === fieldNumber) {
              break;
            } else {
              throw new SyntaxError("Non-matching EGROUP");
            }
          }
          this.#skipFieldValue(innerFieldNumber, wireType);
        }
        break;
      case TYPE_I32:
        this.#pos += 4;
        break;
      default:
        throw new SyntaxError(`Unexpected wire type ${wireType}`);
    }
  }

  #readLEN(): Uint8Array {
    const length = this.#readVarint32();
    return this.#readBytes(length);
  }

  #readBytes(length: number): Uint8Array {
    if (this.#pos + length > this.#buf.length) {
      throw new SyntaxError("Unexpected end of buffer");
    }
    const result = this.#buf.subarray(this.#pos, this.#pos + length);
    this.#pos += length;
    return result;
  }

  #readVarint32(): number {
    let result = 0;
    let mult = 1;
    while (true) {
      const byte = this.#readByte();
      result |= (byte & 0x7F) * mult;
      if (result >= (2 ** 32)) {
        // The final result is greater than or equal to the current `result` value
        // meaning it eventually overflows.
        throw new SyntaxError("Varint32 is too large");
      }
      if ((byte & 0x80) === 0) {
        // If the last byte is 00, it's a redundant leading zero.
        // But a single 00 is exception: it can't be shortened.
        if (byte === 0 && mult > 1) {
          throw new SyntaxError("Redundant leading zero in varint");
        }
        return result;
      }
      mult *= 2 ** 7;
      if (mult >= 2 ** 32) {
        // Nonredundancy implies that the final result is
        // greater than or equal to `result + (1n << shift)`.
        throw new SyntaxError("Varint32 is too large");
      }
    }
  }

  /** Used for uint64, int64, and sint64 */
  #readVarint64(): bigint {
    let result = 0n;
    let shift = 0n;
    while (true) {
      const byte = this.#readByte();
      result |= BigInt(byte & 0x7F) << shift;
      if (result >= (1n << 64n)) {
        // The final result is greater than or equal to the current `result` value
        // meaning it eventually overflows.
        throw new SyntaxError("Varint64 is too large");
      }
      if ((byte & 0x80) === 0) {
        // If the last byte is 00, it's a redundant leading zero.
        // But a single 00 is exception: it can't be shortened.
        if (byte === 0 && shift > 0n) {
          throw new SyntaxError("Redundant leading zero in varint");
        }
        return result;
      }
      shift += 7n;
      if (shift >= 64n) {
        // Nonredundancy implies that the final result is
        // greater than or equal to `result + (1n << shift)`.
        throw new SyntaxError("Varint64 is too large");
      }
    }
  }

  #readByte(): number {
    if (this.#pos >= this.#buf.length) {
      throw new SyntaxError("Unexpected end of buffer");
    }
    return this.#buf[this.#pos++];
  }
}

export const WRITE_FLAG_FIXED_INT = 1;

export type MessageWriteController = {
  writeVarint(fieldNumber: number, value: bigint | number): void;
  writeI32(fieldNumber: number, value: number): void;
  writeF32(fieldNumber: number, value: number): void;
  writeI64(fieldNumber: number, value: bigint): void;
  writeF64(fieldNumber: number, value: number): void;
  writeBytes(fieldNumber: number, value: Uint8Array | string): void;
  writeSubMessage<M>(fieldNumber: number, obj: M, writer: MessageWriter<M>): void;
  writeGroup<M>(fieldNumber: number, obj: M, writer: MessageWriter<M>): void;
  writePackedVarint(fieldNumber: number, values: (bigint | number)[]): void;
  writePackedI32(fieldNumber: number, values: number[]): void;
  writePackedF32(fieldNumber: number, values: number[]): void;
  writePackedI64(fieldNumber: number, values: bigint[]): void;
  writePackedF64(fieldNumber: number, values: number[]): void;
};
export type MessageWriter<M> = {
  writeMessage(obj: M, controller: MessageWriteController): void;
};

export function encodeProtobuf<M>(obj: M, writer: MessageWriter<M>): Uint8Array {
  const encoder = new MessageEncoder();
  encoder.writeMessage(obj, writer);
  return encoder.getResult();
}

class MessageEncoder {
  #buf = new Uint8Array(10);
  #bufView = new DataView(this.#buf.buffer);
  #pos = 0;

  getResult(): Uint8Array {
    return this.#buf.subarray(0, this.#pos);
  }

  writeMessage<M>(obj: M, writer: MessageWriter<M>) {
    const controller = new MessageEncoder.#controller(this, MessageEncoder.#controllerSecret);
    try {
      writer.writeMessage(obj, controller);
    } finally {
      MessageEncoder.#controller.deactivate(controller, MessageEncoder.#controllerSecret);
    }
  }

  static #controllerSecret: unknown = {};
  static #controller = class MessageWriteControllerImpl implements MessageWriteController {
    #encoder: MessageEncoder;
    #active = true;

    constructor(encoder: MessageEncoder, secret: unknown) {
      if (secret !== MessageEncoder.#controllerSecret) {
        throw new TypeError("Illegal constructor call");
      }
      this.#encoder = encoder;
    }
    static deactivate(instance: MessageWriteControllerImpl, secret: unknown) {
      if (secret !== MessageEncoder.#controllerSecret) {
        throw new TypeError("Illegal method call");
      }
      instance.#active = false;
    }

    #getEncoder(): MessageEncoder {
      if (!this.#active) {
        throw new TypeError("Controller is deactivated");
      }
      return this.#encoder;
    }

    writeVarint(fieldNumber: number, value: bigint | number): void {
      const encoder = this.#getEncoder();
      encoder.#writeTag(fieldNumber, TYPE_VARINT);
      if (typeof value === "bigint") {
        encoder.#writeVarint64(value);
      } else {
        encoder.#writeVarint32(value);
      }
    }
    writeI32(fieldNumber: number, value: number): void {
      const encoder = this.#getEncoder();
      encoder.#writeTag(fieldNumber, TYPE_I32);
      encoder.#writeI32(value);
    }
    writeF32(fieldNumber: number, value: number): void {
      const encoder = this.#getEncoder();
      encoder.#writeTag(fieldNumber, TYPE_I32);
      encoder.#writeF32(value);
    }
    writeI64(fieldNumber: number, value: bigint): void {
      const encoder = this.#getEncoder();
      encoder.#writeTag(fieldNumber, TYPE_I64);
      encoder.#writeI64(value);
    }
    writeF64(fieldNumber: number, value: number): void {
      const encoder = this.#getEncoder();
      encoder.#writeTag(fieldNumber, TYPE_I64);
      encoder.#writeF64(value);
    }
    writeBytes(fieldNumber: number, value: Uint8Array | string): void {
      const encoder = this.#getEncoder();
      if (typeof value === "string") {
        value = new TextEncoder().encode(value);
      }
      encoder.#writeTag(fieldNumber, TYPE_LEN);
      encoder.#writeLEN(value);
    }
    writeSubMessage<M>(fieldNumber: number, obj: M, writer: MessageWriter<M>): void {
      const encoder = this.#getEncoder();
      // Temporarily deactivate
      this.#active = false;
      try {
        encoder.#writeTag(fieldNumber, TYPE_LEN);
        encoder.#reserveLength();
        encoder.writeMessage(obj, writer);
      } finally {
        encoder.#writeReservedLength();
        this.#active = true;
      }
    }
    writeGroup<M>(fieldNumber: number, obj: M, writer: MessageWriter<M>): void {
      const encoder = this.#getEncoder();
      // Temporarily deactivate
      this.#active = false;
      try {
        encoder.#writeTag(fieldNumber, TYPE_SGROUP);
        encoder.writeMessage(obj, writer);
      } finally {
        encoder.#writeTag(fieldNumber, TYPE_EGROUP);
        this.#active = true;
      }
      throw new Error("Method not implemented.");
    }
    writePackedVarint(fieldNumber: number, values: (bigint | number)[]): void {
      const encoder = this.#getEncoder();
      if (values.length === 0) {
        return;
      }
      let byteLength = 0;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        byteLength += typeof v === "number" ? countVarint32(v) : countVarint64(v);
      }
      encoder.#preparePacked(fieldNumber, byteLength);
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (typeof v === "number") {
          encoder.#writeVarint32(v);
        } else {
          encoder.#writeVarint64(v);
        }
      }
    }
    writePackedI32(fieldNumber: number, values: number[]): void {
      const encoder = this.#getEncoder();
      if (values.length === 0) {
        return;
      }
      encoder.#preparePacked(fieldNumber, values.length * 4);
      for (let i = 0; i < values.length; i++) {
        encoder.#writeI32(values[i]);
      }
    }
    writePackedF32(fieldNumber: number, values: number[]): void {
      const encoder = this.#getEncoder();
      if (values.length === 0) {
        return;
      }
      encoder.#preparePacked(fieldNumber, values.length * 4);
      for (let i = 0; i < values.length; i++) {
        encoder.#writeF32(values[i]);
      }
    }
    writePackedI64(fieldNumber: number, values: bigint[]): void {
      const encoder = this.#getEncoder();
      if (values.length === 0) {
        return;
      }
      encoder.#preparePacked(fieldNumber, values.length * 8);
      for (let i = 0; i < values.length; i++) {
        encoder.#writeI64(values[i]);
      }
    }
    writePackedF64(fieldNumber: number, values: number[]): void {
      const encoder = this.#getEncoder();
      if (values.length === 0) {
        return;
      }
      encoder.#preparePacked(fieldNumber, values.length * 8);
      for (let i = 0; i < values.length; i++) {
        encoder.#writeF64(values[i]);
      }
    }
  };

  #writeTag(fieldNumber: number, wireType: number) {
    this.#writeVarint32((fieldNumber << 3) | wireType);
  }

  #preparePacked(fieldNumber: number, byteLength: number) {
    this.#writeTag(fieldNumber, TYPE_LEN);
    this.#writeVarint32(byteLength);
    this.#reserve(this.#pos + byteLength);
  }

  #writeI32(value: number) {
    this.#reserve(this.#pos + 4);
    this.#bufView.setUint32(this.#pos, value, true);
    this.#pos += 4;
  }

  #writeF32(value: number) {
    this.#reserve(this.#pos + 4);
    this.#bufView.setFloat32(this.#pos, value, true);
    this.#pos += 4;
  }

  #writeI64(value: bigint) {
    this.#reserve(this.#pos + 8);
    this.#bufView.setBigUint64(this.#pos, value, true);
    this.#pos += 8;
  }

  #writeF64(value: number) {
    this.#reserve(this.#pos + 8);
    this.#bufView.setFloat64(this.#pos, value, true);
    this.#pos += 8;
  }

  #writeLEN(bytes: Uint8Array) {
    this.#writeVarint32(bytes.length);
    this.#writeBytes(bytes);
  }

  #writeBytes(bytes: Uint8Array) {
    this.#reserve(this.#pos + bytes.length);
    this.#buf.set(bytes, this.#pos);
    this.#pos += bytes.length;
  }

  #writeVarint32(value: number) {
    this.#reserve(this.#pos + countVarint32(value));
    while (value >= 0x80) {
      this.#buf[this.#pos++] = (value & 0x7F) | 0x80;
      value >>>= 7;
    }
    this.#buf[this.#pos++] = value;
  }

  /** Used for uint64, int64, and sint64 */
  #writeVarint64(value: bigint) {
    this.#reserve(this.#pos + countVarint64(value));
    while (value >= 0x80n) {
      this.#buf[this.#pos++] = Number(value & 0x7Fn) | 0x80;
      value >>= 7n;
    }
    this.#buf[this.#pos++] = Number(value);
  }

  /**
   * During writing, activeStack records a list of start positions
   * where the length of the content is not yet known
   * in the ascending order.
   * 
   * During resolution, activeStack is reused to record the start and end positions
   * where the shift operation takes place
   * in the ascending order of the start positions.
   */
  #activeStack: [number, number][] = [];
  /**
   * shiftStack records the start and end positions
   * where the contents should be shifted later
   * in the ascending order of the end positions.
   */
  #shiftStack: [number, number][] = [];

  /**
   * Reserve the minimum space for length encoding,
   * and record the position for later shift operation.
   */
  #reserveLength() {
    this.#reserve(this.#pos + 1);
    this.#pos++;
    this.#activeStack.push([this.#pos, 0]);
  }

  /**
   * Finalize the length of the range initiated by #reserveLength.
   */
  #writeReservedLength() {
    const range = this.#activeStack.pop()!;
    range[1] = this.#pos;
    // One byte is already reserved
    const extraLength = countVarint32(range[1] - range[0]) - 1;
    if (extraLength > 0) {
      // Reserve space **after** the content
      this.#reserve(this.#pos + extraLength);
      this.#pos += extraLength;
      this.#shiftStack.push(range);
    }
    if (this.#activeStack.length === 0) {
      this.#resolveReservedLengths();
    }
  }

  /**
   * Run a sequence of shift operations so that the real length
   * is written to the reserved space.
   */
  #resolveReservedLengths() {
    let currentShift = 0;
    let currentPos = this.#pos;
    while (this.#shiftStack.length > 0 || this.#activeStack.length > 0) {
      const range1 = this.#shiftStack[this.#shiftStack.length - 1];
      const range2 = this.#activeStack[this.#activeStack.length - 1];
      if (range1 == null || range1[1] <= range2![0]) {
        let rangeStart = range2![0];
        const length = range2![1] - range2![0];
        this.#activeStack.pop()!;

        if (currentShift > 0) {
          this.#buf.copyWithin(rangeStart + currentShift, rangeStart, currentPos - currentShift);
          rangeStart += currentShift;
        }
        const lengthOfLength = countVarint32(length);
        const extraLength = lengthOfLength - 1;
        this.#writeVarint32At(length, rangeStart - lengthOfLength);
        currentPos = rangeStart - lengthOfLength;
        currentShift -= extraLength;
      } else {
        let rangeEnd = range1![1];
        const length = range1![1] - range1![0];
        this.#activeStack.push(range1!);
        this.#shiftStack.pop()!;

        if (currentShift > 0) {
          this.#buf.copyWithin(rangeEnd + currentShift, rangeEnd, currentPos - currentShift);
          rangeEnd += currentShift;
        }
        const lengthOfLength = countVarint32(length);
        const extraLength = lengthOfLength - 1;
        currentPos = rangeEnd;
        currentShift += extraLength;
      }
    }
  }

  #writeVarint32At(value: number, pos: number) {
    while (value >= 0x80) {
      this.#buf[pos++] = (value & 0x7F) | 0x80;
      value >>>= 7;
    }
    this.#buf[pos++] = value;
  }

  #reserve(demand: number) {
    if (demand > this.#buf.length) {
      const newCap = Math.max(this.#buf.length + (this.#buf.length >> 1), demand);
      if ((ArrayBuffer.prototype as ArrayBuffer & { transfer(newByteLength?: number): ArrayBuffer }).transfer) {
        this.#buf = new Uint8Array((this.#buf.buffer as ArrayBuffer & { transfer(newByteLength?: number): ArrayBuffer }).transfer(newCap));
      } else {
        const newBuf = new Uint8Array(newCap);
        newBuf.set(this.#buf);
        this.#buf = newBuf;
      }
      this.#bufView = new DataView(this.#buf.buffer);
    }
  }
}

function countVarint32(value: number): number {
  if (value < 2 ** 7) {
    return 1;
  } else if (value < 2 ** 14) {
    return 2;
  } else if (value < 2 ** 21) {
    return 3;
  } else if (value < 2 ** 28) {
    return 4;
  } else if (value < 2 ** 32) {
    return 5;
  } else {
    throw new RangeError("Varint32 value is too large");
  }
}
function countVarint64(value: bigint): number {
  if (value < 1n << 7n) {
    return 1;
  } else if (value < 1n << 14n) {
    return 2;
  } else if (value < 1n << 21n) {
    return 3;
  } else if (value < 1n << 28n) {
    return 4;
  } else if (value < 1n << 35n) {
    return 5;
  } else if (value < 1n << 42n) {
    return 6;
  } else if (value < 1n << 49n) {
    return 7;
  } else if (value < 1n << 56n) {
    return 8;
  } else if (value < 1n << 63n) {
    return 9;
  } else if (value < 1n << 64n) {
    return 10;
  } else {
    throw new RangeError("Varint64 value is too large");
  }
}

export type FieldBehavior<M> = {
  readonly fieldName: string;
  readonly fieldNumber: number;
  initField(obj: M): void;
  finalizeField?(obj: M): void;

  writeField(obj: M, controller: MessageWriteController): void;
} & FieldReader<M>;

export type CamelCase<S extends string> = S extends `${infer L}_${infer R}`
  ? `${L}${PascalCase<R>}`
  : S;
export type PascalCase<S extends string> = Capitalize<CamelCase<S>>;

function camelize<K extends string>(s: K): CamelCase<K> {
  return s.replace(/_(.)/g, (_, c) => c.toUpperCase()) as CamelCase<K>;
}

export type RequiredFieldOptions = {
  /**
   * Use proto2 legacy required behavior rather than modern implicit presence.
   *
   * It corresponds with `features.field_presence = LEGACY_REQUIRED` or proto2 `required`.
   */
  legacy?: boolean;
};

/**
 * Remember the last received value, or the default value if nothing was received.
 * 
 * Corresponds with:
 * 
 * - `features.field_presence = IMPLICIT` or `features.field_presence = LEGACY_REQUIRED` configuration
 * - `required` label in proto2
 * - no label in proto3
 * 
 * But it is not applicable if:
 *
 *
 * - `optional` or `repeated` is used
 * - Part of `oneof`
 * - the type is a submessage, a group or `map`.
 */
export class RequiredField<K extends string, T> implements FieldBehavior<Record<CamelCase<K>, T>> {
  #originalFieldName: K;
  #fieldName: CamelCase<K>;
  #scalarType: ScalarType<T>;
  #fieldNumber: number;
  #legacy: boolean;

  constructor(fieldName: K, scalarType: ScalarType<T>, fieldNumber: number, options: RequiredFieldOptions = {}) {
    const { legacy = false } = options;
    this.#originalFieldName = fieldName;
    this.#fieldName = camelize(fieldName);
    this.#scalarType = scalarType;
    this.#fieldNumber = fieldNumber;
    this.#legacy = legacy;
  }

  get fieldName(): string {
    return this.#fieldName;
  }
  get fieldNumber(): number {
    return this.#fieldNumber;
  }

  initField(obj: Record<CamelCase<K>, T>): void {
    if (!this.#legacy) {
      obj[this.#fieldName] = undefined as (T | undefined) as T;
    } else {
      obj[this.#fieldName] = this.#scalarType.defaultValue();
    }
  }
  finalizeField(obj: Record<CamelCase<K>, T>): void {
    if (this.#legacy) {
      if (obj[this.#fieldName] == null) {
        throw new SyntaxError("Required field is missing");
      }
    }
  }

  get fieldFlags(): number {
    return this.#scalarType.fieldFlags & ~READ_FLAG_PACKABLE;
  }
  setField(obj: Record<CamelCase<K>, T>, fieldType: number, value: bigint | number | Uint8Array): void {
    obj[this.#fieldName] = this.#scalarType.toScalar(fieldType, value);
  }

  writeField(obj: Record<CamelCase<K>, T>, controller: MessageWriteController): void {
    if (this.#legacy || !this.#scalarType.isDefaultValue(obj[this.#fieldName])) {
      this.#scalarType.writeScalar(obj[this.#fieldName], this.#fieldNumber, controller);
    }
  }
}

/**
 * Remember if it received a value and the last value if it did.
 * 
 * Corresponds with:
 * 
 * - `features.field_presence = EXPLICIT` configuration
 * - `optional` label in proto3 and proto2
 * - Any part of `oneof`
 * - Submessage or group type
 * 
 * But it is not applicable if:
 * 
 * - `repeated` is used
 * - the type is `map`.
 */
export class OptionalField<K extends string, T> implements FieldBehavior<Record<CamelCase<K>, T | undefined>> {
  #originalFieldName: K;
  #fieldName: CamelCase<K>;
  #scalarType: ScalarOrMessageType<T> | (() => ScalarOrMessageType<T>);
  #fieldNumber: number;

  constructor(
    fieldName: K,
    scalarType: ScalarOrMessageType<T> | (() => ScalarOrMessageType<T>),
    fieldNumber: number,
  ) {
    this.#originalFieldName = fieldName;
    this.#fieldName = camelize(fieldName);
    this.#scalarType = scalarType;
    this.#fieldNumber = fieldNumber;
  }

  get fieldName(): string {
    return this.#fieldName;
  }
  get fieldNumber(): number {
    return this.#fieldNumber;
  }

  #resolveType(): ScalarOrMessageType<T> {
    if (typeof this.#scalarType === "function") {
      const f = this.#scalarType;
      this.#scalarType = f();
    }
    return this.#scalarType;
  }

  initField(obj: Record<CamelCase<K>, T | undefined>): void {
    obj[this.#fieldName] = undefined;
  }

  get fieldFlags(): number {
    const scalarType = this.#resolveType();
    return scalarType.fieldFlags & ~READ_FLAG_PACKABLE;
  }
  setField(obj: Record<CamelCase<K>, T | undefined>, fieldType: number, value: bigint | number | Uint8Array): void {
    const scalarType = this.#resolveType();
    obj[this.#fieldName] = scalarType.toScalar(fieldType, value);
  }
  // deno-lint-ignore no-explicit-any
  setGroup(obj: Record<CamelCase<K>, T>): [subObj: any, subReader: MessageReader<any>] | undefined {
    const scalarType = this.#resolveType();
    const groupPair = scalarType.createGroup?.();
    if (groupPair == null) {
      return undefined;
    }
    obj[this.#fieldName] = groupPair[0];
    return groupPair;
  }

  writeField(obj: Record<CamelCase<K>, T | undefined>, controller: MessageWriteController): void {
    const scalarType = this.#resolveType();
    const value = obj[this.#fieldName];
    if (value != null) {
      scalarType.writeScalar(value, this.#fieldNumber, controller);
    }
  }
}

export type RepeatedFieldOptions = {
  /**
   * Prefer packed encoding if available.
   *
   * Corresponds with:
   *
   * - `features.repeated_field_encoding = PACKED` configuration
   * - `packed = true`
   * - Default behavior in Edition 2023 and proto3
   */
  packed?: boolean;
};

/**
 * Retain all data for the given field number as an array.
 * 
 * Corresponds with `repeated` label in edition 2023, proto3, and proto2.
 */
export class RepeatedField<K extends string, T> implements FieldBehavior<Record<CamelCase<K>, T[]>> {
  #originalFieldName: K;
  #fieldName: CamelCase<K>;
  #scalarType: ScalarOrMessageType<T> | (() => ScalarOrMessageType<T>);
  #fieldNumber: number;
  #packed: boolean;

  constructor(
    fieldName: K,
    scalarType: ScalarOrMessageType<T> | (() => ScalarOrMessageType<T>),
    fieldNumber: number,
    options: RepeatedFieldOptions = {}
  ) {
    const { packed = true } = options;
    this.#originalFieldName = fieldName;
    this.#fieldName = camelize(fieldName);
    this.#scalarType = scalarType;
    this.#fieldNumber = fieldNumber;
    this.#packed = packed;
  }

  get fieldName(): string {
    return this.#fieldName;
  }
  get fieldNumber(): number {
    return this.#fieldNumber;
  }

  #resolveType(): ScalarOrMessageType<T> {
    if (typeof this.#scalarType === "function") {
      const f = this.#scalarType;
      this.#scalarType = f();
    }
    return this.#scalarType;
  }

  initField(obj: Record<CamelCase<K>, T[]>): void {
    obj[this.#fieldName] = [];
  }

  get fieldFlags(): number {
    const scalarType = this.#resolveType();
    return scalarType.fieldFlags;
  }
  setField(obj: Record<CamelCase<K>, T[]>, fieldType: number, value: bigint | number | Uint8Array): void {
    const scalarType = this.#resolveType();
    obj[this.#fieldName].push(scalarType.toScalar(fieldType, value));
  }
  // deno-lint-ignore no-explicit-any
  setGroup(obj: Record<CamelCase<K>, T[]>): [subObj: any, subReader: MessageReader<any>] | undefined {
    const scalarType = this.#resolveType();
    const groupPair = scalarType.createGroup?.();
    if (groupPair == null) {
      return undefined;
    }
    obj[this.#fieldName].push(groupPair[0]);
    return groupPair;
  }

  writeField(obj: Record<CamelCase<K>, T[]>, controller: MessageWriteController): void {
    const scalarType = this.#resolveType();
    if (scalarType.writePacked && this.#packed) {
      if (obj[this.#fieldName].length === 0) {
        return;
      }
      scalarType.writePacked(obj[this.#fieldName], this.#fieldNumber, controller);
    } else {
      for (const value of obj[this.#fieldName]) {
        scalarType.writeScalar(value, this.#fieldNumber, controller);
      }
    }
  }
}

export type ScalarOrMessageType<T> = {
  readonly fieldFlags: number;
  toScalar(fieldType: number, value: bigint | number | Uint8Array): T;
  writeScalar(value: T, fieldNumber: number, controller: MessageWriteController): void;
  writePacked?(values: T[], fieldNumber: number, controller: MessageWriteController): void;
  createGroup?(): [subObj: T, subReader: MessageReader<T>] | undefined;
};
export type ScalarType<T> = {
  defaultValue(): T;
  isDefaultValue(value: T): boolean;
} & ScalarOrMessageType<T>;

export type ContravariantifyFields<F extends FieldBehavior<unknown>[]> = {
  [K in keyof F]: F[K] extends FieldBehavior<infer T> ? (value: T) => void : never;
};

// deno-lint-ignore no-explicit-any
export function createMessageType<const F extends FieldBehavior<any>[]>(
  name: string,
  fields: F,
): MessageType<ContravariantifyFields<F> extends ((value: infer M) => void)[] ? M : never> {
  return createMessageTypeImpl(name, fields);
}
function createMessageTypeImpl<M>(
  name: string,
  fields: FieldBehavior<M>[],
): MessageType<M> {
  const fieldsByNumber = new Map<number, FieldBehavior<M>>();
  for (const field of fields) {
    fieldsByNumber.set(field.fieldNumber, field);
  }
  class Message {
    constructor(values: Partial<M> = {}) {
      for (const field of fields) {
        field.initField(this as unknown as M);
        const initValue = (values as Record<string, unknown>)[field.fieldName];
        if (initValue != null) {
          (this as Record<string, unknown>)[field.fieldName] = initValue;
        }
      }
    }

    static get fieldFlags(): number {
      return 0;
    }
    static toScalar(fieldType: number, value: bigint | number | Uint8Array): M {
      if (fieldType !== TYPE_LEN) {
        throw new TypeError("Unexpected field type");
      }
      return decodeProtobuf(value as Uint8Array, Message as MessageType<M>);
    }
    static writeScalar(value: M, fieldNumber: number, controller: MessageWriteController): void {
      controller.writeSubMessage(fieldNumber, value, Message);
    }
    static getFieldReader(fieldNumber: number): FieldReader<M> | undefined {
      return fieldsByNumber.get(fieldNumber);
    }
    static writeMessage(obj: M, controller: MessageWriteController): void {
      for (const field of fields) {
        field.writeField(obj, controller);
      }
    }
  }
  const lastName = name.split(".").pop()!;
  Object.defineProperty(Message, "name", {
    value: lastName,
  });
  return Message satisfies ScalarOrMessageType<M> & MessageReader<M> & MessageWriter<M> as MessageType<M>;
}

export type MessageType<M> = ScalarOrMessageType<M> & MessageReader<M> & MessageWriter<M> & {
  new(values?: Partial<M> | undefined): M;
};

export const BoolType: ScalarType<boolean> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE;
  },
  defaultValue(): boolean {
    return false;
  },
  isDefaultValue(value: boolean): boolean {
    return !value;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): boolean {
    if (fieldType !== TYPE_VARINT) {
      throw new TypeError("Unexpected field type");
    }
    return value !== 0;
  },
  writeScalar(value: boolean, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeVarint(fieldNumber, Number(Boolean(value)));
  },
  writePacked(values: boolean[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedVarint(fieldNumber, values.map((value) => Number(Boolean(value))));
  }
};

function assertUint64Range(value: bigint, typeContext: string): bigint {
  if (value < 0n || value >= (1n << 64n)) {
    throw new RangeError(`Value ${value} is out of range for ${typeContext}`);
  }
  return value;
}
function assertInt64Range(value: bigint, typeContext: string): bigint {
  if (value < -(1n << 63n) || value >= (1n << 63n)) {
    throw new RangeError(`Value ${value} is out of range for ${typeContext}`);
  }
  return value;
}
function assertUint32Range(value: number, typeContext: string): number {
  if (value < 0 || value >= 2 ** 32) {
    throw new RangeError(`Value ${value} is out of range for ${typeContext}`);
  } else if (!Number.isInteger(value)) {
    throw new RangeError(`Value ${value} is not an integer for ${typeContext}`);
  }
  return value;
}
function assertInt32Range(value: number, typeContext: string): number {
  if (value < -(2 ** 31) || value >= 2 ** 31) {
    throw new RangeError(`Value ${value} is out of range for ${typeContext}`);
  } else if (!Number.isInteger(value)) {
    throw new RangeError(`Value ${value} is not an integer for ${typeContext}`);
  }
  return value;
}
function encodeComplTwo64(value: bigint): bigint {
  return value & ((1n << 64n) - 1n);
}
function decodeComplTwo64(value: bigint): bigint {
  return value | -(value & (1n << 63n));
}
function encodeComplTwo32(value: number): number {
  return value >>> 0;
}
function decodeComplTwo32(value: number): number {
  return value | 0;
}
function encodeZigzag64(value: bigint): bigint {
  return (value << 1n) ^ -BigInt(value < 0n)
}
function decodeZigzag64(value: bigint): bigint {
  return (value >> 1n) ^ -(value & 1n);
}
function encodeZigzag32(value: number): number {
  return ((value << 1) ^ -Number(value < 0)) >>> 0;
}
function decodeZigzag32(value: number): number {
  return (value >> 1) ^ -(value & 1);
}

export const Uint64Type: ScalarType<bigint> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_VARINT64;
  },
  defaultValue(): bigint {
    return 0n;
  },
  isDefaultValue(value: bigint): boolean {
    return value === 0n;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): bigint {
    if (fieldType !== TYPE_VARINT) {
      throw new TypeError("Unexpected field type");
    }
    return value as bigint;
  },
  writeScalar(value: bigint, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeVarint(fieldNumber, assertUint64Range(value, "uint64"));
  },
  writePacked(values: bigint[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedVarint(fieldNumber, values.map((value) => assertUint64Range(value, "uint64")));
  }
};

export const Int64Type: ScalarType<bigint> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_VARINT64;
  },
  defaultValue(): bigint {
    return 0n;
  },
  isDefaultValue(value: bigint): boolean {
    return value === 0n;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): bigint {
    if (fieldType !== TYPE_VARINT) {
      throw new TypeError("Unexpected field type");
    }
    return decodeComplTwo64(value as bigint);
  },
  writeScalar(value: bigint, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeVarint(fieldNumber, encodeComplTwo64(assertInt64Range(value, "int64")));
  },
  writePacked(values: bigint[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedVarint(fieldNumber, values.map((value) => encodeComplTwo64(assertInt64Range(value, "int64"))));
  }
};

export const Uint32Type: ScalarType<number> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE;
  },
  defaultValue(): number {
    return 0;
  },
  isDefaultValue(value: number): boolean {
    return value === 0;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): number {
    if (fieldType !== TYPE_VARINT) {
      throw new TypeError("Unexpected field type");
    }
    return value as number;
  },
  writeScalar(value: number, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeVarint(fieldNumber, assertUint32Range(value, "uint32"));
  },
  writePacked(values: number[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedVarint(fieldNumber, values.map((value) => assertUint32Range(value, "uint32")));
  }
};

export const Int32Type: ScalarType<number> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE;
  },
  defaultValue(): number {
    return 0;
  },
  isDefaultValue(value: number): boolean {
    return value === 0;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): number {
    if (fieldType !== TYPE_VARINT) {
      throw new TypeError("Unexpected field type");
    }
    return decodeComplTwo32(value as number);
  },
  writeScalar(value: number, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeVarint(fieldNumber, encodeComplTwo32(assertInt32Range(value, "int32")));
  },
  writePacked(values: number[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedVarint(fieldNumber, values.map((value) => encodeComplTwo32(assertInt32Range(value, "int32"))));
  }
};

export const Sint64Type: ScalarType<bigint> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_VARINT64;
  },
  defaultValue(): bigint {
    return 0n;
  },
  isDefaultValue(value: bigint): boolean {
    return value === 0n;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): bigint {
    if (fieldType !== TYPE_VARINT) {
      throw new TypeError("Unexpected field type");
    }
    return decodeZigzag64(value as bigint);
  },
  writeScalar(value: bigint, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeVarint(fieldNumber, encodeZigzag64(assertInt64Range(value, "sint64")));
  },
  writePacked(values: bigint[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedVarint(fieldNumber, values.map((value) => encodeZigzag64(assertInt64Range(value, "sint64"))));
  }
};

export const Sint32Type: ScalarType<number> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE;
  },
  defaultValue(): number {
    return 0;
  },
  isDefaultValue(value: number): boolean {
    return value === 0;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): number {
    if (fieldType !== TYPE_VARINT) {
      throw new TypeError("Unexpected field type");
    }
    return decodeZigzag32(value as number);
  },
  writeScalar(value: number, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeVarint(fieldNumber, encodeZigzag32(assertInt32Range(value, "sint32")));
  },
  writePacked(values: number[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedVarint(fieldNumber, values.map((value) => encodeZigzag32(assertInt32Range(value, "sint32"))));
  }
};

export const Fixed64Type: ScalarType<bigint> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_I64 | READ_FLAG_FIXED_INT;
  },
  defaultValue(): bigint {
    return 0n;
  },
  isDefaultValue(value: bigint): boolean {
    return value === 0n;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): bigint {
    if (fieldType !== TYPE_I64) {
      throw new TypeError("Unexpected field type");
    }
    return value as bigint;
  },
  writeScalar(value: bigint, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeI64(fieldNumber, assertUint64Range(value, "fixed64"));
  },
  writePacked(values: bigint[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedI64(fieldNumber, values.map((value) => assertUint64Range(value, "fixed64")));
  }
};

export const Fixed32Type: ScalarType<number> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_I32 | READ_FLAG_FIXED_INT;
  },
  defaultValue(): number {
    return 0;
  },
  isDefaultValue(value: number): boolean {
    return value === 0;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): number {
    if (fieldType !== TYPE_I32) {
      throw new TypeError("Unexpected field type");
    }
    return value as number;
  },
  writeScalar(value: number, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeI32(fieldNumber, assertUint32Range(value, "fixed32"));
  },
  writePacked(values: number[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedI32(fieldNumber, values.map((value) => assertUint32Range(value, "fixed32")));
  }
};

export const Sfixed64Type: ScalarType<bigint> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_I64 | READ_FLAG_FIXED_INT;
  },
  defaultValue(): bigint {
    return 0n;
  },
  isDefaultValue(value: bigint): boolean {
    return value === 0n;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): bigint {
    if (fieldType !== TYPE_I64) {
      throw new TypeError("Unexpected field type");
    }
    return decodeComplTwo64(value as bigint);
  },
  writeScalar(value: bigint, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeI64(fieldNumber, encodeComplTwo64(assertInt64Range(value, "sfixed64")));
  },
  writePacked(values: bigint[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedI64(fieldNumber, values.map((value) => encodeComplTwo64(assertInt64Range(value, "sfixed64"))));
  }
};

export const Sfixed32Type: ScalarType<number> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_I32 | READ_FLAG_FIXED_INT;
  },
  defaultValue(): number {
    return 0;
  },
  isDefaultValue(value: number): boolean {
    return value === 0;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): number {
    if (fieldType !== TYPE_I32) {
      throw new TypeError("Unexpected field type");
    }
    return decodeComplTwo32(value as number);
  },
  writeScalar(value: number, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeI32(fieldNumber, encodeComplTwo32(assertInt32Range(value, "sfixed32")));
  },
  writePacked(values: number[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedI32(fieldNumber, values.map((value) => encodeComplTwo32(assertInt32Range(value, "sfixed32"))));
  }
};

export const DoubleType: ScalarType<number> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_I64;
  },
  defaultValue(): number {
    return 0;
  },
  isDefaultValue(value: number): boolean {
    return Object.is(value, 0);
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): number {
    if (fieldType !== TYPE_I64) {
      throw new TypeError("Unexpected field type");
    }
    return value as number;
  },
  writeScalar(value: number, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeF64(fieldNumber, value);
  },
  writePacked(values: number[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedF64(fieldNumber, values);
  }
};

// IEEE 754 binary32 has 1 sign + 8 exponent + 23 fraction
//
// As the bias is 127 the raw exponent value is -127 to 128
// and -127 is actually subnormal with exponent -126.
//
// In subnormal the smallest positive fraction is 2^-23 therefore
// the smallest representable value is 2^-126 * 2^-23 = 2^-149.
//
// This value is half the smallest representable value
// which means values less than or equal to this value
// will be rounded down to zero.
//
// Note that in round-to-nearest half-to-even mode,
// which TypedArray NumericToRawBytes uses,
// the exact FLOAT32_ROUNDDOWN_POINT will be rounded to zero.
const FLOAT32_ROUNDDOWN_POINT = 2 ** -150;

export const FloatType: ScalarType<number> = {
  get fieldFlags(): number {
    return READ_FLAG_PACKABLE | READ_FLAG_I32;
  },
  defaultValue(): number {
    return 0;
  },
  isDefaultValue(value: number): boolean {
    return Object.is(value, 0) || (0 < value && value <= FLOAT32_ROUNDDOWN_POINT);
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): number {
    if (fieldType !== TYPE_I32) {
      throw new TypeError("Unexpected field type");
    }
    return value as number;
  },
  writeScalar(value: number, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeF32(fieldNumber, value);
  },
  writePacked(values: number[], fieldNumber: number, controller: MessageWriteController): void {
    controller.writePackedF32(fieldNumber, values);
  }
};

export const BytesType: ScalarType<Uint8Array> = {
  get fieldFlags(): number {
    return 0;
  },
  defaultValue(): Uint8Array {
    return new Uint8Array(0);
  },
  isDefaultValue(value: Uint8Array): boolean {
    return value.length === 0;
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): Uint8Array {
    if (fieldType !== TYPE_LEN) {
      throw new TypeError("Unexpected field type");
    }
    return value as Uint8Array;
  },
  writeScalar(value: Uint8Array, fieldNumber: number, controller: MessageWriteController): void {
    controller.writeBytes(fieldNumber, value);
  }
};

export const StringType: ScalarType<string> = {
  get fieldFlags(): number {
    return 0;
  },
  defaultValue(): string {
    return "";
  },
  isDefaultValue(value: string): boolean {
    return value === "";
  },
  toScalar(fieldType: number, value: bigint | number | Uint8Array): string {
    if (fieldType !== TYPE_LEN) {
      throw new TypeError("Unexpected field type");
    }
    try {
      return new TextDecoder("UTF-8", { fatal: true }).decode(value as Uint8Array);
    } catch (e) {
      if (e instanceof TypeError) {
        throw new SyntaxError("Invalid UTF-8 encoding");
      }
      throw e;
    }
  },
  writeScalar(value: string, fieldNumber: number, controller: MessageWriteController): void {
    if (!value.isWellFormed()) {
      throw new TypeError("Non-well-formed UTF-16 string was given");
    }
    controller.writeBytes(fieldNumber, value);
  }
};

export class ByteString {
  #bytes: Uint8Array;
  constructor(source: Uint8Array | string) {
    if (typeof source === "string") {
      if (!source.isWellFormed()) {
        throw new TypeError("Non-well-formed UTF-16 string was given");
      }
      this.#bytes = new TextEncoder().encode(source);
    } else {
      this.#bytes = source;
    }
  }

  get bytes(): Uint8Array {
    return this.#bytes;
  }

  toString(): string {
    return new TextDecoder().decode(this.#bytes);
  }
}
