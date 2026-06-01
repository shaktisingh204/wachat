import { z } from 'zod';

import { longContextCostSchema } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/long-context-cost.schema';

export type LongContextCost = z.infer<typeof longContextCostSchema>;
