import { z } from 'zod';

export const quoteSourceSchema = z.object({ bookId: z.string().min(1).max(120),
  assetHash: z.string().min(1).max(120), page: z.number().int().min(1).max(2000),
  rawText: z.string().min(1).max(10000),
  anchor: z.object({ version: z.literal(1), start: z.number().int().min(0), end: z.number().int().min(1),
    prefix: z.string().max(32), suffix: z.string().max(32) }).strict() }).strict();
