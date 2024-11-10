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

export async function* parseRows(lines: AsyncIterable<string> | Iterable<string>): AsyncIterable<string[]> {
  for await (const line of lines) {
    const row = parseRow(line);
    if (row) {
      yield row;
    }
  }
}

export function ensureEnum<T, U extends T>(value: T, set: ReadonlySet<U>): U {
  if (!set.has(value as U)) {
    throw new Error(`Invalid value: ${value} (allowed: ${Array.from(set)})`);
  }
  return value as U;
}

export function parseInteger(text: string): number {
  if (!/^(?:0|-?[1-9][0-9]*)$/.test(text)) {
    throw new SyntaxError(`Invalid integer: ${text}`);
  }
  return parseInt(text, 10);
}

export function parseShortBinaryValue(text: string): boolean {
  switch (text) {
    case "Y":
      return true;
    case "N":
      return false;
    default:
      throw new SyntaxError(`Invalid value: ${text} (allowed: Y, N)`);
  }
}
