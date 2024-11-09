export function getNNNN(codepoint: number): string {
  return codepoint.toString(16).toUpperCase().padStart(4, "0");
}
