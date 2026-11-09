const LABEL_LENGTH = 40;

/** Long topics are cut for labels, so a screen reader is not read a paragraph per button. */
export function shortenForLabel(text: string): string {
  return text.length > LABEL_LENGTH ? `${text.slice(0, LABEL_LENGTH).trimEnd()}…` : text;
}
