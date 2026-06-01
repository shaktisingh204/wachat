"use server";

import "server-only";

// PORT-NOTE: Ported from twenty-server AgentTurnResolver (NestJS GraphQL).
// @Query/@Mutation/@UseGuards decorators removed. Exported as plain server actions/functions.
// Auth/permission checks (WorkspaceAuthGuard, SettingsPermissionGuard AI_SETTINGS) must be
// enforced by the calling Next.js route layer before invoking these functions.

import { getAgentTurnCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-turn.entity";
import { getAgentChatThreadCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity";
import type { AgentTurnDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/dtos/agent-turn.dto";
import type { AgentTurnEvaluationDTO } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-monitor/dtos/agent-turn-evaluation.dto";
import { evaluateTurn } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-monitor/services/agent-turn-grader.service";
import { findOneAgentById } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/agent.service";
import { runEvaluationInputJob } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-monitor/jobs/run-evaluation-input.job";

// ---- Query: agentTurns ----

export async function getAgentTurns({
  agentId,
  workspaceId,
}: {
  agentId: string;
  workspaceId: string;
}): Promise<AgentTurnDTO[]> {
  const turnCollection = await getAgentTurnCollection();

  const turns = await turnCollection
    .find({ agentId, workspaceId })
    .sort({ createdAt: -1 })
    .toArray();

  // Relations (evaluations, messages, messages.parts) are fetched lazily by callers
  // or via the module-level aggregation helpers.
  return turns as unknown as AgentTurnDTO[];
}

// ---- Mutation: evaluateAgentTurn ----

export async function evaluateAgentTurn({
  turnId,
  workspaceId,
}: {
  turnId: string;
  workspaceId: string;
}): Promise<AgentTurnEvaluationDTO> {
  const evaluation = await evaluateTurn({ turnId, workspaceId });

  return {
    id: evaluation._id.toHexString(),
    turnId: evaluation.turnId,
    score: evaluation.score,
    comment: evaluation.comment,
    createdAt: evaluation.createdAt,
  };
}

// ---- Mutation: runEvaluationInput ----

export async function runEvaluationInput({
  agentId,
  input,
  workspaceId,
  userWorkspaceId,
}: {
  agentId: string;
  input: string;
  workspaceId: string;
  userWorkspaceId: string;
}): Promise<AgentTurnDTO> {
  // Ownership check — throws AiException if agent not in workspace
  await findOneAgentById({ id: agentId, workspaceId });

  const threadCollection = await getAgentChatThreadCollection();
  const turnCollection = await getAgentTurnCollection();

  const now = new Date();

  const threadInsertResult = await threadCollection.insertOne({
    userWorkspaceId,
    title: `Eval: ${input.substring(0, 50)}...`,
    workspaceId,
    agentId,
    createdAt: now,
    updatedAt: now,
  } as Parameters<typeof threadCollection.insertOne>[0]);

  const threadId = threadInsertResult.insertedId.toHexString();

  const turnInsertResult = await turnCollection.insertOne({
    threadId,
    agentId,
    workspaceId,
    createdAt: now,
    updatedAt: now,
  } as Parameters<typeof turnCollection.insertOne>[0]);

  const turnId = turnInsertResult.insertedId.toHexString();

  // Enqueue the async job (direct call — wrap in a queue adapter as needed)
  void runEvaluationInputJob({
    turnId,
    threadId,
    agentId,
    input,
    workspaceId,
  });

  const turn = await turnCollection.findOne({
    _id: turnInsertResult.insertedId,
  });

  if (!turn) {
    throw new Error("Turn not found after creation");
  }

  return turn as unknown as AgentTurnDTO;
}
