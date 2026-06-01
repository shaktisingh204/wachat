// PORT-NOTE: Module wiring — NestJS @Module has no Next.js equivalent.
// This index re-exports all ported pieces that the original AiAgentRoleModule wired together.
// Original imports: TypeOrmModule for AgentEntity, RoleEntity, RoleTargetEntity; RoleTargetModule.
// Original providers: AiAgentRoleService + workspace-scoped repos for all three entities.
// Exports: AiAgentRoleService.

export {
  assignRoleToAgent,
  removeRoleFromAgent,
  getAgentsAssignedToRole,
  deleteAgentOnlyRoleIfUnused,
} from "./ai-agent-role.service";
