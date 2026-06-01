// PORT-NOTE: Ported from twenty-server ai-agent/dtos/agent.dto.ts (GraphQL ObjectType).
// NestJS GraphQL @ObjectType/@Field/@HideField decorators and class-validator removed.
// Exported as a plain TypeScript type.

import type { ModelConfiguration } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/modelConfiguration";
import type { ModelId } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/model-id.type";

export type AgentDTO = {
  id: string;
  name: string;
  label: string;
  icon?: string;
  description?: string;
  prompt: string;
  modelId: ModelId;
  responseFormat?: object;
  roleId?: string;
  isCustom: boolean;
  /** Hidden from API consumers — internal tenant scope */
  workspaceId: string;
  applicationId?: string;
  createdAt: Date;
  updatedAt: Date;
  modelConfiguration?: ModelConfiguration;
  evaluationInputs: string[];
};
