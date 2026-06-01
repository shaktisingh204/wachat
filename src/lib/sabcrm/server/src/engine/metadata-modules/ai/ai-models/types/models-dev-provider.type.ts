import { type ModelsDevModel } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/models-dev-model.type';

export type ModelsDevProvider = {
  // Provider id from models.dev (e.g. `openai`).
  id: string;
  // Keys are model identifiers in that provider's catalog (bare ids), not composite `provider/modelName` workspace ids.
  models: Record<string, ModelsDevModel>;
};
