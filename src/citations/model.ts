export const MAX_QUOTE_LENGTH = 10_000;
export type CitationIntent = 'quote' | 'explain' | 'example' | 'question' | 'note';
export interface TextAnchor {
  version: 1;
  start: number;
  end: number;
  prefix: string;
  suffix: string;
}
export interface QuoteSource {
  bookId: string;
  assetHash: string;
  page: number;
  rawText: string;
  anchor: TextAnchor;
}
export interface Citation extends QuoteSource {
  id: string;
  intent: CitationIntent;
  editedText: string;
  createdAt: number;
}
export const intentLabels: Record<CitationIntent, string> = {
  quote: '摘录', explain: '解释这段', example: '举个例子', question: '提问', note: '记笔记',
};
