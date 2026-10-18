import { z } from 'zod';
export const outlineOperations = {
  'outline.get': z.object({ query: z.string().min(1).max(200).optional(), offset: z.number().int().min(0).max(5000).optional(),
    limit: z.number().int().min(1).max(100).optional() }).strict(),
  'outline.navigate': z.object({ target: z.enum(['entry', 'title', 'chapter', 'contents', 'panel']),
    entryId: z.string().min(1).max(120).optional(), title: z.string().min(1).max(200).optional(),
    chapter: z.number().int().min(1).max(999).optional(), outlineVersion: z.string().min(1).max(200).optional() }).strict(),
};
