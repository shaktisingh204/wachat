import "server-only";

// PORT-NOTE: Ported from twenty-server AgentTurnGraderService (NestJS Injectable).
// NestJS DI decorators removed. Exported as plain functions.
// AiModelRegistryService replaced with a direct import of the ported function.
// WorkspaceScopedRepository replaced with Mongo collection accessors.

import { generateText } from "ai";

import { getAgentTurnCollection } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-turn.entity";
import type { AgentTurnDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-turn.entity";
import {
  getAgentTurnEvaluationCollection,
  type AgentTurnEvaluationDocument,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-monitor/entities/agent-turn-evaluation.entity";
import { getDefaultSpeedModel } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/services/ai-model-registry.service";
import { AI_TELEMETRY_CONFIG } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const";

// ---- public API ----

export async function evaluateTurn({
  turnId,
  workspaceId,
}: {
  turnId: string;
  workspaceId: string;
}): Promise<AgentTurnEvaluationDocument> {
  const turnCollection = await getAgentTurnCollection();

  const turn = await turnCollection.findOne({ id: turnId, workspaceId });

  if (!turn) {
    throw new Error(`Turn ${turnId} not found`);
  }

  const { score, comment } = await evaluateWithAI(turn);

  const evaluationCollection = await getAgentTurnEvaluationCollection();

  const now = new Date();

  const result = await evaluationCollection.insertOne({
    turnId,
    workspaceId,
    score,
    comment,
    createdAt: now,
  } as unknown as AgentTurnEvaluationDocument);

  const inserted = await evaluationCollection.findOne({
    _id: result.insertedId,
  });

  if (!inserted) {
    throw new Error("Failed to retrieve inserted evaluation");
  }

  return inserted;
}

// ---- private helpers ----

type MessageLike = {
  role: string;
  parts?: Array<{
    type?: string;
    textContent?: string | null;
    reasoningContent?: string | null;
    toolName?: string | null;
    errorMessage?: string | null;
  }>;
};

async function evaluateWithAI(
  turn: AgentTurnDocument & { messages?: MessageLike[] },
): Promise<{ score: number; comment: string }> {
  try {
    const defaultModel = await getDefaultSpeedModel();

    if (!defaultModel) {
      console.warn(
        "[AgentTurnGraderService] No default AI model available for evaluation",
      );

      return getFallbackEvaluation(turn);
    }

    const evaluationContext = buildEvaluationContext(turn);

    const prompt = `You are evaluating an AI agent's performance on a single turn (user request + agent response).

${evaluationContext}

Evaluate this agent turn based on:
1. **Task Completion**: Did the agent accomplish what the user asked?
2. **Tool Usage**: Were tools used correctly and appropriately?
3. **Response Quality**: Is the response clear, accurate, and helpful?
4. **Error Handling**: Were errors handled gracefully?

Provide:
- A score from 0 to 100 (0 = complete failure, 100 = perfect)
- A brief comment explaining the score (max 200 characters)

Respond ONLY with valid JSON in this exact format:
{"score": <number>, "comment": "<string>"}`;

    const result = await generateText({
      model: defaultModel.model,
      prompt,
      temperature: 0.3,
      experimental_telemetry: AI_TELEMETRY_CONFIG,
    });

    const parsed = JSON.parse(result.text) as { score: number; comment: string };

    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      comment: (parsed.comment || "Evaluation completed").substring(0, 500),
    };
  } catch (error) {
    console.error(
      "[AgentTurnGraderService] Failed to evaluate turn with AI:",
      error,
    );

    return getFallbackEvaluation(turn);
  }
}

function buildEvaluationContext(
  turn: AgentTurnDocument & { messages?: MessageLike[] },
): string {
  const messages = turn.messages ?? [];
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");

  const userText = userMessages
    .flatMap((m) => m.parts ?? [])
    .filter((p) => p.textContent)
    .map((p) => p.textContent)
    .join("\n");

  const assistantParts = assistantMessages.flatMap((m) => m.parts ?? []);

  const assistantText = assistantParts
    .filter((p) => p.textContent)
    .map((p) => p.textContent)
    .join("\n");

  const toolCalls = assistantParts
    .filter((p) => p.toolName)
    .map((p) => ({
      tool: p.toolName,
      hasError: Boolean(p.errorMessage),
      error: p.errorMessage,
    }));

  const errors = assistantParts
    .filter((p) => p.errorMessage)
    .map((p) => p.errorMessage);

  let context = `**User Request:**\n${userText || "(no text)"}\n\n`;
  context += `**Agent Response:**\n${assistantText || "(no text response)"}\n\n`;

  if (toolCalls.length > 0) {
    context += `**Tools Used:**\n${toolCalls
      .map((t) => `- ${t.tool}${t.hasError ? " (FAILED)" : ""}`)
      .join("\n")}\n\n`;
  }

  if (errors.length > 0) {
    context += `**Errors:**\n${errors.map((e) => `- ${e}`).join("\n")}\n\n`;
  }

  return context;
}

function getFallbackEvaluation(
  turn: AgentTurnDocument & { messages?: MessageLike[] },
): { score: number; comment: string } {
  const parts = (turn.messages ?? []).flatMap((m) => m.parts ?? []);
  const errorCount = parts.filter((p) => p.errorMessage).length;
  const hasResponse = parts.some((p) => p.textContent);
  const toolCount = parts.filter((p) => p.toolName).length;

  let score = 100;

  if (errorCount > 0) {
    score -= errorCount * 30;
  }

  if (!hasResponse) {
    score -= 50;
  }

  const comments: string[] = [];

  if (errorCount > 0) comments.push(`${errorCount} error(s)`);
  if (toolCount > 0) comments.push(`${toolCount} tool(s) used`);
  if (!hasResponse) comments.push("No response");

  return {
    score: Math.max(0, score),
    comment: comments.length > 0 ? comments.join("; ") : "Completed",
  };
}
