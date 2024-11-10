export interface BitFieldDescriptor<T> {
  readonly bits: number;
  encode(value: T): number;
  decode(bits: number): T;
};

export class BooleanBitField implements BitFieldDescriptor<boolean> {
  get bits(): number {
    return 1;
  }
  encode(value: boolean): number {
    return Number(value);
  }
  decode(bits: number): boolean {
    return Boolean(bits);
  }
}

export class NumericBitField implements BitFieldDescriptor<number> {
  #maxValue: number;
  #bits: number;

  constructor(maxValue: number, bits: number) {
    if (maxValue >= (1 << bits)) {
      throw new RangeError(`Bit length ${bits} is too short for maximum value ${maxValue}`);
    }
    this.#maxValue = maxValue;
    this.#bits = bits;
  }

  get bits(): number {
    return this.#bits;
  }

  encode(value: number): number {
    if (value > this.#maxValue) {
      throw new RangeError(`Value ${value} is out of range for maximum value ${this.#maxValue}`);
    }
    return value;
  }

  decode(bits: number): number {
    if (bits > this.#maxValue) {
      throw new RangeError(`Value ${bits} are out of range for maximum value ${this.#maxValue}`);
    }
    return bits;
  }
}

export class EnumBitField<T> implements BitFieldDescriptor<T> {
  #values: T[];
  #reverseMap: Map<T, number>;
  #bits: number;

  constructor(values: T[], bits: number) {
    if (values.length > (1 << bits)) {
      throw new RangeError(`Bit length ${bits} is too short for ${values.length} values`);
    }
    this.#values = values;
    this.#reverseMap = new Map(values.map((value, index) => [value, index]));
    this.#bits = bits;
  }

  get bits(): number {
    return this.#bits;
  }

  encode(value: T): number {
    if (!this.#reverseMap.has(value)) {
      throw new RangeError(`Value ${value} is not a valid enum value`);
    }
    return this.#reverseMap.get(value)!;
  }

  decode(bits: number): T {
    if (bits >= this.#values.length) {
      throw new RangeError(`Value ${bits} is out of range for ${this.#values.length} values`);
    }
    return this.#values[bits];
  }
}

export type EachBitFieldDescriptor<T> = {
  [K in keyof T]: BitFieldDescriptor<T[K]>;
}

export type BitStructFieldDescription<T> = BitStructFieldDescriptionFor<T, keyof T>;
export type BitStructFieldDescriptionFor<T, K extends keyof T> =
  K extends keyof T ? [K, BitFieldDescriptor<T[K]>] : never;

export class BitStruct<T> implements BitFieldDescriptor<T> {
  #fields: EachBitFieldDescriptor<T>;
  #fieldOrder: (keyof T)[];
  #bits: number;

  constructor(fields: EachBitFieldDescriptor<T>, fieldOrder?: (keyof T)[]) {
    this.#fields = fields;
    if (fieldOrder === undefined) {
      this.#fieldOrder = Object.keys(fields) as (keyof T)[];
    } else {
      const originalKeys = new Set(Object.keys(fields) as (keyof T)[]);
      const fieldOrderSet = new Set(fieldOrder);
      if (!fieldOrderSet.isSubsetOf(originalKeys)) {
        const extraKeys = Array.from(fieldOrderSet.difference(originalKeys));
        throw new TypeError(`Field order contains unknown fields: ${extraKeys}`);
      }
      if (!originalKeys.isSubsetOf(fieldOrderSet)) {
        const missingKeys = Array.from(originalKeys.difference(fieldOrderSet));
        throw new TypeError(`Field order is missing fields: ${missingKeys}`);
      }
      if (fieldOrder.length !== fieldOrderSet.size) {
        throw new TypeError("Field order contains duplicate fields");
      }
      this.#fieldOrder = fieldOrder;
    }
    this.#bits = this.#fieldOrder.reduce((bits, key) => bits + fields[key].bits, 0);
  }

  get bits(): number {
    return this.#bits;
  }

  encode(value: T): number {
    let bits = 0;
    let shift = 0;
    for (const key of this.#fieldOrder) {
      const field = this.#fields[key];
      const fieldValue = value[key];
      bits |= field.encode(fieldValue) << shift;
      shift += field.bits;
    }
    return bits;
  }

  decode(bits: number): T {
    const value: Partial<T> = {};
    let shift = 0;
    for (const key of this.#fieldOrder) {
      const field = this.#fields[key];
      value[key] = field.decode((bits >> shift) & ((1 << field.bits) - 1));
      shift += field.bits;
    }
    return value as T;
  }
}
