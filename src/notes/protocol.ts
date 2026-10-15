import { z } from 'zod';
import { quoteSourceSchema } from '../citations/schema.ts';
import { discoveryOperations } from './discoveryProtocol.ts';

const id = z.string().min(1).max(120);
const page = z.number().int().min(1).max(2000);
const text = z.object({ title: z.string().trim().min(1).max(120).optional(),
  userContent: z.string().max(20000).default('') });
export const noteCreateSchema = z.discriminatedUnion('kind', [
  text.extend({ kind: z.literal('quote'), source: quoteSourceSchema.optional(), citationId: id.optional() }).strict(),
  text.extend({ kind: z.literal('answer'), conversationId: id, messageId: id,
    expectedSequence: z.number().int().min(0), questionMessageId: id.optional(), page: page.optional() }).strict(),
  text.extend({ kind: z.literal('page'), page }).strict(),
]).refine(value => value.kind !== 'quote' || !!value.source !== !!value.citationId,
  '摘录必须提供选段或引用 ID 中的一项。');
export type NoteCreateInput = z.input<typeof noteCreateSchema>;
export type NoteCreate = z.output<typeof noteCreateSchema>;
export const noteOperations = {
  ...discoveryOperations,
  'notes.create': noteCreateSchema,
  'notes.list': z.object({}).strict(),
  'notes.get': z.object({ noteId: id }).strict(),
  'notes.update': z.object({ noteId: id, expectedRevision: z.number().int().min(1),
    title: z.string().trim().min(1).max(120), userContent: z.string().max(20000) }).strict(),
  'notes.delete': z.object({ noteId: id, expectedRevision: z.number().int().min(1), confirmed: z.boolean() }).strict(),
} as const;
