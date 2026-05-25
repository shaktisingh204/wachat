import { z } from 'zod';

export const customer_portal_schema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  portalUrl: z.string().min(1, "portalUrl is required"),
  status: z.enum(['active', 'suspended'])
});

export type CustomerPortalType = z.infer<typeof customer_portal_schema> & { _id: string; createdAt: Date; updatedAt: Date };
