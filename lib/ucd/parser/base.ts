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
