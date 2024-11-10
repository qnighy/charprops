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
