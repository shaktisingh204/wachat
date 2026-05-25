import { z } from 'zod';

export const quote_to_cash_schema = z.object({
  quoteId: z.string().min(1, "quoteId is required"),
  amount: z.coerce.number(),
  status: z.enum(['draft', 'sent', 'paid'])
});

export type QuoteToCashType = z.infer<typeof quote_to_cash_schema> & { _id: string; createdAt: Date; updatedAt: Date };
