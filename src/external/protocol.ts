import { outlineOperations } from './outline-protocol.ts';
import { z } from 'zod';
import { quoteSourceSchema } from '../citations/schema.ts';
import { noteOperations } from '../notes/protocol.ts';

const id = z.string().min(1).max(120);
const page = z.number().int().min(1).max(2000);
export const messageSchema = z.object({ conversationId: id, messageId: id, sequence: z.number().int().min(0),
  role: z.enum(['assistant', 'user']).default('assistant'), text: z.string().max(20000),
  status: z.enum(['streaming', 'complete', 'cancelled', 'error']), citationIds: z.array(id).max(20).default([]),
  sourceLabel: z.string().min(1).max(80).default('外部 AI') }).strict();
export const operations = {
  'sessions.list': z.object({}).strict(),
  'requests.get': z.object({ targetRequestId: id }).strict(),
  'books.list': z.object({}).strict(),
  'reader.open': z.object({}).strict(),
  'context.get': z.object({}).strict(),
  'page.read': z.object({ page }).strict(),
  'draft.get': z.object({}).strict(),
  'citations.list': z.object({}).strict(),
  'citation.create': z.object({ source: quoteSourceSchema.optional(), intent: z.enum(['quote', 'explain', 'example', 'question', 'note']).default('quote'),
    editedText: z.string().min(1).max(10000).optional() }).strict(),
  'citation.locate': z.object({ citationId: id }).strict(),
  'reader.navigate': z.object({ page, zoom: z.union([z.object({ mode: z.literal('fit-width') }),
    z.object({ mode: z.literal('percent'), percent: z.number().min(25).max(300) })]).optional() }).strict(),
  'reader.return': z.object({}).strict(),
  'reader.continue': z.object({}).strict(),
  'conversation.publish': messageSchema,
  'conversation.list': z.object({}).strict(),
  ...noteOperations,
  ...outlineOperations,
} as const;
export type Operation = keyof typeof operations;
export const requestSchema = z.object({ requestId: id, operation: z.enum(Object.keys(operations) as [Operation, ...Operation[]]),
  sessionId: id.optional(), bookId: id.optional(), contextVersion: id.optional(), params: z.record(z.string(), z.unknown()).default({}) }).strict();
export type BridgeRequest = z.infer<typeof requestSchema>;
export interface BridgeCommand extends BridgeRequest { clientId: string; expiresAt: number }
export type BridgeResult = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };
export interface ReaderSnapshot { bookId: string | null; title: string; page: number; contextVersion: string }
export const snapshotSchema = z.object({ bookId: id.nullable(), title: z.string().max(120),
  page: z.number().int().min(0).max(2000), contextVersion: id }).strict();
export const durableOperations = new Set<Operation>(['citation.create', 'conversation.publish', 'notes.create', 'notes.update', 'notes.delete']);
export const contextualOperations = new Set<Operation>(['context.get', 'page.read', 'draft.get', 'citation.create',
  'outline.get', 'outline.navigate', 'citation.locate', 'reader.navigate', 'reader.return', 'reader.continue']);
export class BridgeError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export function parseRequest(value: unknown): BridgeRequest {
  const result = requestSchema.safeParse(value);
  if (!result.success) throw new BridgeError('INVALID_REQUEST', '请求结构无效。');
  const params = operations[result.data.operation].safeParse(result.data.params);
  if (!params.success) throw new BridgeError('INVALID_PARAMS', '操作参数无效。');
  return { ...result.data, params: params.data };
}
export function failure(error: unknown): BridgeResult {
  return { ok: false, error: error instanceof BridgeError ? { code: error.code, message: error.message }
    : { code: 'OPERATION_FAILED', message: '操作未完成，请检查连接或重试。' } };
}
export function fingerprint(request: BridgeRequest) {
  return JSON.stringify({ operation: request.operation, bookId: request.bookId,
    contextVersion: request.contextVersion, params: request.params });
}
