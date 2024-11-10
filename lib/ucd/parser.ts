import { lines } from "../lines.ts";

export function parseRow(row: string): string[] | null {
  const commentPos = row.indexOf('#');
  if (commentPos >= 0) {
    row = row.substring(0, commentPos);
  }
  row = row.trim();
  if (row === '') {
    return null;
  }
  return row.split(';').map((field) => field.trim());
}

export function parseCodePoint(text: string): number {
  // TODO: handle U+ added in Unihan
  if (!/^[0-9a-f]{4,6}$/i.test(text)) {
    throw new SyntaxError(`Invalid code point: ${text}`);
  }
  const cp = parseInt(text, 16);
  // Deliberately allowing surrogates
  if (cp < 0 || cp > 0x10FFFF) {
    throw new SyntaxError(`Invalid code point: ${text}`);
  }
  return cp;
}
export type CodePointOrRange = CodePointData | CodePointRange;
export type CodePointData = {
  type: "CodePoint";
  codepoint: number;
};
export function CodePointData(codepoint: number): CodePointData {
  return { type: "CodePoint", codepoint };
}
export type CodePointRange = {
  type: "CodePointRange";
  start: number;
  end: number;
};
export function CodePointRange(start: number, end: number): CodePointRange {
  return { type: "CodePointRange", start, end };
}

export function parseCodePointOrRange(text: string): CodePointOrRange {
  const parts = text.split('..');
  if (parts.length === 0) {
    throw new SyntaxError(`Invalid code point: ${text}`);
  } else if (parts.length === 1) {
    return CodePointData(parseCodePoint(parts[0]));
  } else if (parts.length === 2) {
    return CodePointRange(parseCodePoint(parts[0]), parseCodePoint(parts[1]));
  } else {
    throw new SyntaxError(`Invalid code point range: ${text}`);
  }
}

export type NameData =
  | RegularNameData
  | DerivableNameData
  | RangeIdentifierStartData
  | RangeIdentifierEndData;

export type RegularNameData = {
  type: "RegularName";
  name: string;
};
export function RegularNameData(name: string): RegularNameData {
  return { type: "RegularName", name };
}
export type DerivableNameData = {
  type: "DerivableName";
  label: string;
};
export function DerivableNameData(label: string): DerivableNameData {
  return { type: "DerivableName", label };
}
export type RangeIdentifierStartData = {
  type: "RangeIdentifierStart";
  identifier: string;
};
export function RangeIdentifierStartData(identifier: string): RangeIdentifierStartData {
  return { type: "RangeIdentifierStart", identifier };
}
export type RangeIdentifierEndData = {
  type: "RangeIdentifierEnd";
  identifier: string;
};
export function RangeIdentifierEndData(identifier: string): RangeIdentifierEndData {
  return { type: "RangeIdentifierEnd", identifier };
}

export function parseName(text: string): NameData {
  if (text.startsWith('<') && text.endsWith('>')) {
    const enclosed = text.substring(1, text.length - 1);
    const parts = enclosed.split(',').map((part) => part.trim());
    if (parts.length === 2 && parts[1] === 'First') {
      return RangeIdentifierStartData(parts[0]);
    } else if (parts.length === 2 && parts[1] === 'Last') {
      return RangeIdentifierEndData(parts[0]);
    }
    return DerivableNameData(enclosed);
  }
  return RegularNameData(text);
}

export type Jamos = Record<number, string>;

export async function parseJamos(path: string): Promise<Jamos> {
  const jamos: Jamos = {};
  const file = await Deno.open(path);
  for await (const line of lines(file.readable)) {
    const row = parseRow(line);
    if (row == null) {
      continue;
    }
    if (row.length < 2) {
      throw new SyntaxError(`Invalid row: ${line}`);
    }
    const [codepointText, nameText] = row;
    jamos[parseCodePoint(codepointText)] = nameText;
  }
  return jamos;
}
