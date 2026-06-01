import { z } from 'zod';

import { AI_SDK_PACKAGES } from '@/lib/sabcrm/shared/src/ai/constants/ai-sdk-packages.const';
import { DATA_RESIDENCY_KEYS } from '@/lib/sabcrm/shared/src/ai/constants/data-residency.const';

import { aiProviderAuthTypeSchema } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-provider-auth-type.schema';
import { aiProviderModelConfigSchema } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-provider-model-config.schema';

export const aiProviderConfigSchema = z.object({
  npm: z.enum(AI_SDK_PACKAGES),
  name: z.string().optional(),
  label: z.string().optional(),
  authType: aiProviderAuthTypeSchema.optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  region: z.string().optional(),
  dataResidency: z.enum(DATA_RESIDENCY_KEYS).optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
  models: z.array(aiProviderModelConfigSchema).optional(),
});
