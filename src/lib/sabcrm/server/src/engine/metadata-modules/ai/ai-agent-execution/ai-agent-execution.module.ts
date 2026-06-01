// PORT-NOTE: Module wiring — NestJS @Module has no Next.js equivalent.
// This index re-exports all ported pieces that the original module wired together:
// entities, resolvers, and services. Consumers import directly from here.
// TypeORM feature registration and forwardRef to ToolProviderModule are dropped —
// Mongo collection accessors are used instead.

export type { AgentMessagePartDocument } from "./entities/agent-message-part.entity";
export {
  getAgentMessagePartCollection,
} from "./entities/agent-message-part.entity";

export type { AgentMessageDocument } from "./entities/agent-message.entity";
export {
  AgentMessageRole,
  AgentMessageStatus,
  getAgentMessageCollection,
} from "./entities/agent-message.entity";

export type { AgentTurnDocument } from "./entities/agent-turn.entity";
export { getAgentTurnCollection } from "./entities/agent-turn.entity";

export type { AgentMessagePartDTO } from "./dtos/agent-message-part.dto";
export type { AgentMessageDTO } from "./dtos/agent-message.dto";
export type { AgentTurnDTO } from "./dtos/agent-turn.dto";

export { resolveAgentMessagePartFileUrl } from "./resolvers/agent-message-part.resolver";

export type { AgentActorContext, UserContext } from "./services/agent-actor-context.service";
export { buildUserAndAgentActorContext } from "./services/agent-actor-context.service";

export type { AgentAsyncExecutorInput } from "./services/agent-async-executor.service";
export { executeAgent } from "./services/agent-async-executor.service";

export type { AgentExecutionResult } from "./types/agent-execution-result.type";

export { mapDBPartsToUIMessageParts } from "./utils/mapDBPartsToUIMessageParts";

export { WORKFLOW_AGENT_REGISTRY_TOOL_CATEGORIES } from "./constants/workflow-agent-registry-tool-categories.const";
