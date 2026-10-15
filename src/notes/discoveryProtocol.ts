import { z } from 'zod';

export const criteriaSchema = z.object({
  query: z.string().max(200).default(''),
  kind: z.enum(['quote', 'answer', 'page']).optional(),
  sort: z.enum(['created_desc', 'created_asc', 'page_asc']).default('created_desc'),
});
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const searchSchema = criteriaSchema.extend({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(50),
  expectedResultVersion: digest.optional(),
}).strict();
export const exportSchema = criteriaSchema.extend({
  sort: criteriaSchema.shape.sort.default('page_asc'),
  chunkIndex: z.number().int().min(0).default(0),
  expectedContentHash: digest.optional(),
}).strict().refine(value => value.chunkIndex === 0 || !!value.expectedContentHash, '后续块需要完整内容摘要。');
export const locateSchema = z.object({ noteId: z.string().min(1).max(120),
  sourceIndex: z.number().int().min(0).default(0) }).strict();
export const discoveryOperations = {
  'notes.search': searchSchema, 'notes.export': exportSchema, 'notes.locate': locateSchema,
} as const;
export type NoteCriteria = z.output<typeof criteriaSchema>;
export type SearchInput = z.input<typeof searchSchema>;
export type ExportInput = z.input<typeof exportSchema>;
