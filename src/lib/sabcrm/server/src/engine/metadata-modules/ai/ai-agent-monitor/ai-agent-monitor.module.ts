// PORT-NOTE: Module wiring — NestJS @Module has no Next.js equivalent.
// This index re-exports all ported pieces that the original AiAgentMonitorModule wired together.
// Original imports: AiAgentExecutionModule, AiAgentModule, AiChatModule, AiModelsModule, PermissionsModule.
// Original providers: AgentTurnGraderService, AgentTurnResolver, EvaluateAgentTurnJob,
//   RunEvaluationInputJob, workspace-scoped repos for AgentTurnEvaluationEntity,
//   AgentTurnEntity, AgentChatThreadEntity, AgentEntity.
// Exports: AgentTurnGraderService.

export type { AgentTurnEvaluationDocument } from "./entities/agent-turn-evaluation.entity";
export { getAgentTurnEvaluationCollection } from "./entities/agent-turn-evaluation.entity";

export type { AgentTurnEvaluationDTO } from "./dtos/agent-turn-evaluation.dto";

export type { EvaluateAgentTurnJobData } from "./jobs/evaluate-agent-turn.job";
export { evaluateAgentTurnJob } from "./jobs/evaluate-agent-turn.job";

export type { RunEvaluationInputJobData } from "./jobs/run-evaluation-input.job";
export { runEvaluationInputJob } from "./jobs/run-evaluation-input.job";

export {
  getAgentTurns,
  evaluateAgentTurn,
  runEvaluationInput,
} from "./resolvers/agent-turn.resolver";

export { evaluateTurn } from "./services/agent-turn-grader.service";
