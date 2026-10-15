import type { QuoteSource } from '../citations/model';

export interface NoteSource extends QuoteSource { citationId: string }
export interface AnswerSnapshot {
  conversationId: string; messageId: string; sequence: number; text: string;
  sourceLabel: string; status: 'complete'; questionText?: string;
}
export interface Note {
  id: string; bookId: string; kind: 'quote' | 'answer' | 'page';
  assetHash: string; page: number; title: string; userContent: string;
  sources: NoteSource[]; aiSnapshot?: AnswerSnapshot; originMessageKey?: string;
  revision: number; createdAt: number; updatedAt: number;
}
export type NoteMetadata = Pick<Note, 'id' | 'title' | 'kind' | 'page' | 'revision' | 'createdAt' | 'updatedAt'>;
export const noteKindLabels = { quote: '摘录', answer: 'AI 回答', page: '页笔记' };
