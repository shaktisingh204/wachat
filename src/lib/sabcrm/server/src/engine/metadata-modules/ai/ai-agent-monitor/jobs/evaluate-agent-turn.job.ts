import "server-only";

// PORT-NOTE: Ported from twenty-server EvaluateAgentTurnJob (NestJS BullMQ processor).
// NestJS @Processor/@Process decorators removed; exported as a plain async function
// that can be enqueued by any background-job adapter (e.g. Vercel Cron, custom queue).

import { evaluateTurn } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-monitor/services/agent-turn-grader.service";

export type EvaluateAgentTurnJobData = {
  turnId: string;
  workspaceId: string;
};

/**
 * Evaluates a completed agent turn and persists the result.
 * Originally processed via MessageQueue.aiQueue.
 */
export async function evaluateAgentTurnJob(
  data: EvaluateAgentTurnJobData,
): Promise<void> {
  if (!data.turnId) {
    throw new Error("Turn ID is required");
  }

  if (!data.workspaceId) {
    throw new Error("Workspace ID is required");
  }

  const evaluation = await evaluateTurn({
    turnId: data.turnId,
    workspaceId: data.workspaceId,
  });

  console.log(
    `[evaluateAgentTurnJob] Evaluation completed for turn ${data.turnId}: score=${evaluation.score}`,
  );
}
