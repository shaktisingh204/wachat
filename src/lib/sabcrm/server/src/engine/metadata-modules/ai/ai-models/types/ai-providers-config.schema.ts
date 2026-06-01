import { z } from 'zod';

import { aiProviderConfigSchema } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-provider-config.schema';

export const aiProvidersConfigSchema = z.record(
  z.string(),
  aiProviderConfigSchema,
);
