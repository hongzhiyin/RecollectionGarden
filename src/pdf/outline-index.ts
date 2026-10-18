import type { OutlineItem } from './usePdfDocument';

export interface IndexedOutline {
  id: string; title: string; parents: string[]; depth: number; item: OutlineItem;
}
export const normalizeTitle = (text: string) => text.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}]+/gu, '');
export function indexOutline(items: OutlineItem[]): IndexedOutline[] {
  const result: IndexedOutline[] = [];
  const visit = (entries: OutlineItem[], path: number[], parents: string[]) => {
    if (path.length > 32) throw new Error('PDF 目录层级超过支持范围');
    entries.forEach((item, index) => {
      if (result.length >= 5000) throw new Error('PDF 目录条目超过支持范围');
      const title = item.title?.trim() || '未命名目录项';
      if (title.length > 2000) throw new Error('PDF 目录标题过长');
      const next = [...path, index];
      result.push({ id: next.join('.'), title, parents, depth: path.length, item });
      if (item.items?.length) visit(item.items, next, [...parents, title]);
    });
  };
  visit(items, [], []); return result;
}
function chineseInteger(text: string): number | undefined {
  if (/^\d+$/.test(text)) return Number(text);
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
  let total = 0, digit = 0;
  for (const char of text) {
    if (Object.hasOwn(digits, char)) digit = digits[char]!;
    else if (units[char]) { total += (digit || 1) * units[char]!; digit = 0; }
    else return;
  }
  return total + digit;
}
export function chapterNumber(title: string): number | undefined {
  const text = title.normalize('NFKC').trim();
  const english = /^(?:chapter|chap\.?)\s*(\d+)(?!\d|\.\d)\b/i.exec(text);
  if (english) return Number(english[1]);
  const chinese = /^第\s*([零〇一二两三四五六七八九十百千\d]+)\s*章/.exec(text);
  return chinese ? chineseInteger(chinese[1]!) : undefined;
}
export function outlineSummary(entry: IndexedOutline) {
  return { id: entry.id, title: entry.title, parents: entry.parents, depth: entry.depth,
    navigable: Boolean(entry.item.dest) && !entry.item.url,
    destination: entry.item.url ? 'external' : entry.item.dest ? 'internal' : 'group' };
}
export function findOutline(entries: IndexedOutline[], query: { target: string; entryId?: string; title?: string; chapter?: number }) {
  if (query.target === 'entry') return entries.filter(e => e.id === query.entryId);
  if (query.target === 'chapter') return entries.filter(e => chapterNumber(e.title) === query.chapter);
  if (query.target === 'contents') return entries.filter(e => ['目录', '目次', 'contents', 'tableofcontents'].includes(normalizeTitle(e.title)));
  const title = normalizeTitle(query.title ?? ''); if (!title) return [];
  const exact = entries.filter(e => normalizeTitle(e.title) === title);
  return exact.length ? exact : entries.filter(e => normalizeTitle(e.title).includes(title));
}
