import type { TextAnchor } from './model';

export function createAnchor(text: string, start: number, end: number): TextAnchor {
  return { version: 1, start, end, prefix: text.slice(Math.max(0, start - 32), start), suffix: text.slice(end, end + 32) };
}

export function cleanQuote(raw: string) {
  return raw.replace(/\r\n?/g, '\n').replace(/([\u3400-\u9fff])\s*\n\s*(?=[\u3400-\u9fff])/g, '$1')
    .replace(/[ \t]*\n[ \t]*/g, ' ').trim();
}

export function locateQuote(text: string, raw: string, anchor: TextAnchor): { start: number; end: number } | null {
  if (!raw || anchor.version !== 1) return null;
  const contextMatches = (start: number, end: number) =>
    text.slice(Math.max(0, start - anchor.prefix.length), start) === anchor.prefix
    && text.slice(end, end + anchor.suffix.length) === anchor.suffix;
  if (Number.isInteger(anchor.start) && Number.isInteger(anchor.end) && anchor.start >= 0
    && anchor.end <= text.length && text.slice(anchor.start, anchor.end) === raw && contextMatches(anchor.start, anchor.end)) {
    return { start: anchor.start, end: anchor.end };
  }
  const first = text.indexOf(raw);
  if (first < 0 || text.indexOf(raw, first + 1) >= 0) return null;
  return { start: first, end: first + raw.length };
}
