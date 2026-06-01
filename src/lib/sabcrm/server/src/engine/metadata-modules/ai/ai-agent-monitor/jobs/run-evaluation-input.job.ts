import "server-only";

// PORT-NOTE: Ported from twenty-server RunEvaluationInputJob (NestJS BullMQ processor).
// NestJS DI / @Processor / @InjectMessageQueue decorators removed.
// Exported as a plain async function. Queue enqueueing is represented as a
// direct call to evaluateAgentTurnJob — callers may wrap in their own queue adapter.
// AgentChatService uses a factory pattern (createAgentChatService) — callers must
// supply a configured service instance via the deps parameter.

import { getAgentCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/entities/agent.entity";
import type { AgentChatService } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat.service";
import { executeAgent } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/services/agent-async-executor.service";
import { evaluateAgentTurnJob } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-monitor/jobs/evaluate-agent-turn.job";

export type RunEvaluationInputJobData = {
  turnId: string;
  threadId: string;
  agentId: string;
  input: string;
  workspaceId: string;
};

export type RunEvaluationInputJobDeps = {
  agentChatService: AgentChatService;
};

/**
 * Runs a single evaluation input through an agent and then enqueues grading.
 * Originally processed via MessageQueue.aiQueue.
 * Callers must supply a configured AgentChatService instance via deps.
 */
export async function runEvaluationInputJob(
  data: RunEvaluationInputJobData,
  deps: RunEvaluationInputJobDeps,
): Promise<void> {
  const { agentChatService } = deps;

  // Persist the user message
  await agentChatService.addMessage({
    threadId: data.threadId,
    turnId: data.turnId,
    uiMessage: {
      role: "user",
      parts: [{ type: "text", text: data.input }],
    },
    workspaceId: data.workspaceId,
  });

  // Fetch the agent from Mongo
  const agentCollection = await getAgentCollection();
  const agent = await agentCollection.findOne({
    id: data.agentId,
    workspaceId: data.workspaceId,
  });

  if (!agent) {
    throw new Error(`Agent ${data.agentId} not found`);
  }

  // Run the agent
  const executionResult = await executeAgent({
    agent,
    userPrompt: data.input,
    workspaceId: data.workspaceId,
    userWorkspaceId: null,
  });

  // Persist the assistant response
  await agentChatService.addMessage({
    threadId: data.threadId,
    turnId: data.turnId,
    agentId: agent.id,
    uiMessage: {
      role: "assistant",
      parts: [
        {
          type: "text",
          text: JSON.stringify(executionResult.result) || "",
        },
      ],
    },
    workspaceId: data.workspaceId,
  });

  // Enqueue grading (direct call — wrap in a queue adapter as needed)
  await evaluateAgentTurnJob({
    turnId: data.turnId,
    workspaceId: data.workspaceId,
  });
}
