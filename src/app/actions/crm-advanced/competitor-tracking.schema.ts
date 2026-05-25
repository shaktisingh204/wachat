import { z } from 'zod';

export const competitor_tracking_schema = z.object({
  competitorName: z.string().min(1, "competitorName is required"),
  marketShare: z.coerce.number(),
  threatLevel: z.enum(['low', 'medium', 'high'])
});

export type CompetitorTrackingType = z.infer<typeof competitor_tracking_schema> & { _id: string; createdAt: Date; updatedAt: Date };
