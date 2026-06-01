// PORT-NOTE: Ported from twenty-server ai-agent/dtos/agent-id.input.ts (GraphQL InputType).
// NestJS GraphQL @InputType/@Field decorators removed.
// Exported as a plain TS type + zod schema for validation.

import { z } from "zod";

export const AgentIdInputSchema = z.object({
  /** The id of the agent. */
  id: z.string().uuid(),
});

export type AgentIdInput = z.infer<typeof AgentIdInputSchema>;
