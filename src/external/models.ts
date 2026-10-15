import type { BridgeResult } from './protocol';

export interface ExternalMessage {
  id: string;
  bookId: string;
  conversationId: string;
  messageId: string;
  sequence: number;
  role: 'assistant' | 'user';
  text: string;
  status: 'streaming' | 'complete' | 'cancelled' | 'error';
  citationIds: string[];
  sourceLabel: string;
  createdAt: number;
}
export interface CompletedRequest {
  id: string;
  signature: string;
  result: BridgeResult;
  createdAt: number;
}
