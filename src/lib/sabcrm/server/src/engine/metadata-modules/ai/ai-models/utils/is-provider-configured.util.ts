import { type AiProviderConfig } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-provider-config.type';

export const isProviderConfigured = (config: AiProviderConfig): boolean =>
  !!(config.apiKey || config.accessKeyId || config.authType);
