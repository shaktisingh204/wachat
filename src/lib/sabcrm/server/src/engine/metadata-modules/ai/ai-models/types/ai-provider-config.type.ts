import { z } from 'zod';

import { aiProviderConfigSchema } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-provider-config.schema';
import { type AiProviderModelConfig } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-provider-model-config.type';

export type AiProviderConfig = Omit<
  z.infer<typeof aiProviderConfigSchema>,
  'models'
> & {
  models?: AiProviderModelConfig[];
};
