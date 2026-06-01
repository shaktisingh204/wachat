import "server-only";

// PORT-NOTE: NestJS @Injectable removed; plain class with constructor injection.

import { type ToolSet } from 'ai';

import { type AiModelConfigService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/services/ai-model-config.service';
import { type RegisteredAiModel } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service';
import { type NativeToolBinder } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/services/native-tool-binder.interface';
import { type NativeModelToolOptions } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/native-model-tool-options.type';

export class NativeToolBinderService implements NativeToolBinder {
  constructor(private readonly aiModelConfigService: AiModelConfigService) {}

  bind(
    model: RegisteredAiModel,
    options: NativeModelToolOptions = {},
  ): ToolSet {
    return this.aiModelConfigService.getNativeModelTools(model, options);
  }
}
