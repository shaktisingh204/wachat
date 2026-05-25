import { z } from 'zod';

export const sla_escalation_schema = z.object({
  ticketId: z.string().min(1, "ticketId is required"),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  escalatedTo: z.string().min(1, "escalatedTo is required")
});

export type SlaEscalationType = z.infer<typeof sla_escalation_schema> & { _id: string; createdAt: Date; updatedAt: Date };
