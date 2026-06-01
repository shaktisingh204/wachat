// PORT-NOTE: Ported from twenty-server mapDBPartsToUIMessageParts.ts.
// Sorts parts by orderIndex, maps each to a UI message part, and filters nulls.

import type { ExtendedUIMessagePart } from "@/lib/sabcrm/shared/src/ai/types/ExtendedUIMessagePart";

import type { AgentMessagePartDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message-part.entity";
import { mapDBPartToUIMessagePart } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/utils/mapDBPartToUIMessagePart";

export const mapDBPartsToUIMessageParts = (
  parts: AgentMessagePartDocument[],
): ExtendedUIMessagePart[] => {
  return parts
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map(mapDBPartToUIMessagePart)
    .filter((part): part is ExtendedUIMessagePart => part !== null);
};
