// PORT-NOTE: Module wiring — NestJS @Module has no Next.js equivalent.
// This index re-exports all ported pieces that the original AiAgentModule wired together.
// Original imports: AiModelsModule, AiAgentRoleModule, ThrottlerModule, AuditModule,
//   FileModule, ObjectMetadataModule, PermissionsModule, WorkspaceCacheStorageModule,
//   WorkspaceMigrationModule, ApplicationModule, FlatAgentModule, WorkspaceCacheModule.
// Original providers: AgentResolver, AgentService, interceptors, workspace-scoped repos.
// Exports: AgentService (all functions), TypeOrmModule.forFeature([AgentEntity]) analogue.

// Entity + collection
export type { AgentDocument } from "./entities/agent.entity";
export { getAgentCollection } from "./entities/agent.entity";

// DTOs / inputs
export type { AgentIdInput } from "./dtos/agent-id.input";
export { AgentIdInputSchema } from "./dtos/agent-id.input";
export type { AgentDTO } from "./dtos/agent.dto";
export type { CreateAgentInput } from "./dtos/create-agent.input";
export { CreateAgentInputSchema } from "./dtos/create-agent.input";
export type { UpdateAgentInput } from "./dtos/update-agent.input";
export { UpdateAgentInputSchema } from "./dtos/update-agent.input";

// Types
export type { AgentResponseFormat, AgentResponseFormatType, AgentTextResponseFormat, AgentJsonResponseFormat } from "./types/agent-response-format.type";
export type { BrowsingContextType } from "./types/browsingContext.type";
export type { ModelConfiguration } from "./types/modelConfiguration";

// Constants
export { AGENT_CONFIG } from "./constants/agent-config.const";
export { WORKFLOW_SYSTEM_PROMPTS } from "./constants/agent-system-prompts.const";

// Service functions (exported flat, no class)
export {
  findManyAgents,
  findOneAgentByName,
  findOneAgentById,
  createOneAgent,
  updateOneAgent,
  deleteOneAgent,
  deleteManyAgents,
  searchAgents,
} from "./agent.service";
export type { FlatAgentWithRoleId } from "./agent.service";

// Resolver (server actions)
export {
  findManyAgentsAction,
  findOneAgentAction,
  createOneAgentAction,
  updateOneAgentAction,
  deleteOneAgentAction,
} from "./agent.resolver";

// Utils
export { fromCreateAgentInputToFlatAgent } from "./utils/from-create-agent-input-to-flat-agent.util";
