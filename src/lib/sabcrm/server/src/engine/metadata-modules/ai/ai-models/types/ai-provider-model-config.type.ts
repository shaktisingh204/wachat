import { z } from 'zod';

import { aiProviderModelConfigSchema } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-provider-model-config.schema';

export type AiModelSource = 'catalog' | 'manual';

export type AiProviderModelConfig = z.infer<
  typeof aiProviderModelConfigSchema
> & {
  source?: AiModelSource;
};
