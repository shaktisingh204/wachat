import { z } from 'zod';

export const automated_lead_routing_schema = z.object({
  name: z.string().min(1, "name is required"),
  status: z.enum(['active', 'inactive']),
  logic: z.string().min(1, "logic is required")
});

export type AutomatedLeadRoutingType = z.infer<typeof automated_lead_routing_schema> & { _id: string; createdAt: Date; updatedAt: Date };
