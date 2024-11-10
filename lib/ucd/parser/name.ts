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
