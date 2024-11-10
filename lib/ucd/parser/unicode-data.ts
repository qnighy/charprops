import { parseRow } from "./base.ts";
import { CodePointData, CodePointOrRange, CodePointRange, parseCodePoint } from "./codepoint.ts";
import { DerivableNameData, parseName, RangeIdentifierStartData, RegularNameData } from "./name.ts";

export type UnicodeDataRow = {
  codepoint: CodePointOrRange;
  name: RegularNameData | DerivableNameData;
};

type UnicodeDataRow01 = {
  codepoint: CodePointOrRange;
  name: RegularNameData | DerivableNameData;
};

export async function* parseUnicodeData(lines: AsyncIterable<string> | Iterable<string>): AsyncIterable<UnicodeDataRow> {
  let lastRangeStart: { name: RangeIdentifierStartData, codepoint: number } | null = null;
  for await (const line of lines) {
    const dataElems = parseRow(line);
    if (dataElems == null) {
      continue;
    }
    if (dataElems.length < 2) {
      throw new SyntaxError(`Invalid row: ${line}`);
    }
    const [codepointText, nameText] = dataElems;
    const codepoint = parseCodePoint(codepointText);
    const nameData = parseName(nameText);
    let row01: UnicodeDataRow01;
    if (lastRangeStart != null) {
      if (nameData.type !== "RangeIdentifierEnd" || nameData.identifier !== lastRangeStart.name.identifier) {
        throw new SyntaxError(`Expected range end of the same name as ${lastRangeStart.name.identifier}, got: ${nameText}`);
      }
      const { codepoint: startCodepoint } = lastRangeStart;
      lastRangeStart = null;
      row01 = {
        codepoint: CodePointRange(startCodepoint, codepoint),
        name: DerivableNameData(nameData.identifier),
      };
    } else if (nameData.type === "RangeIdentifierStart") {
      lastRangeStart = { name: nameData, codepoint: codepoint };
      continue;
    } else if (nameData.type === "RangeIdentifierEnd") {
      throw new SyntaxError(`Unexpected range end: ${nameText}`);
    } else {
      row01 = {
        codepoint: CodePointData(codepoint),
        name: nameData,
      };
    }

    yield {
      ...row01,
    };
  }
}
