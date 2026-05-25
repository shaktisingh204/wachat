import { z } from 'zod';

export const sales_territory_schema = z.object({
  region: z.string().min(1, "region is required"),
  assignedRep: z.string().min(1, "assignedRep is required"),
  status: z.enum(['active', 'inactive'])
});

export type SalesTerritoryType = z.infer<typeof sales_territory_schema> & { _id: string; createdAt: Date; updatedAt: Date };
