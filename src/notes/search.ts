import type { Note, NoteMetadata } from './model';
import type { NoteCriteria } from './discoveryProtocol';

export const normalizeSearch = (text: string) => text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
export async function textDigest(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export interface NoteMatch extends NoteMetadata { matchedFields: string[]; snippet?: string }
function fields(note: Note): [string, string][] {
  return [['title', note.title], ['userContent', note.userContent],
    ...note.sources.map(source => ['rawText', source.rawText] as [string, string]),
    ['aiText', note.aiSnapshot?.text ?? ''], ['questionText', note.aiSnapshot?.questionText ?? '']];
}
export function matchingNotes(notes: Note[], criteria: NoteCriteria) {
  const terms = normalizeSearch(criteria.query).split(' ').filter(Boolean);
  const selected = notes.filter(note => (!criteria.kind || note.kind === criteria.kind)
    && terms.every(term => fields(note).some(([, text]) => normalizeSearch(text).includes(term))));
  const idOrder = (a: Note, b: Note) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return selected.sort((a, b) => {
    if (criteria.sort === 'page_asc') return a.page - b.page || a.createdAt - b.createdAt || idOrder(a, b);
    const time = a.createdAt - b.createdAt;
    return (criteria.sort === 'created_desc' ? -time : time) || idOrder(a, b);
  });
}
export function matchMetadata(note: Note, query: string): NoteMatch {
  const { id, title, kind, page, revision, createdAt, updatedAt } = note;
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  const hits = fields(note).filter(([, text]) => terms.some(term => normalizeSearch(text).includes(term)));
  const hit = hits[0]?.[1];
  return { id, title, kind, page, revision, createdAt, updatedAt,
    matchedFields: [...new Set(hits.map(([field]) => field))],
    ...(hit ? { snippet: excerpt(hit, terms) } : {}) };
}
function excerpt(text: string, terms: string[]) {
  const chars = Array.from(text);
  // Normalization can expand a character. Find a source character window, not a normalized offset.
  const term = terms.find(value => normalizeSearch(text).includes(value));
  let start = 0;
  if (term) {
    const normalized = normalizeSearch(text), offset = normalized.indexOf(term);
    let low = 0, high = chars.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (normalizeSearch(chars.slice(0, middle + 1).join('')).length > offset) high = middle;
      else low = middle + 1;
    }
    start = Math.max(0, low - 30);
  }
  return chars.slice(start, start + 160).join('');
}
