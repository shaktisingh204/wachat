"use server";

/**
 * SabSMS settings — AI agent configuration actions (V2.12).
 *
 * Reads/writes the `sabsms_agent_configs` document the events-worker
 * agent runtime consumes (`src/lib/sabsms/agent/store.ts`). RBAC-gated
 * exactly like the short-links card (`sabsms_settings` view/edit).
 */

import { connectToDatabase } from "@/lib/mongodb";
import { requirePermission } from "@/lib/rbac-server";
import { getCachedSession } from "@/lib/server-cache";
import {
  DEFAULT_ALLOWED_TOOLS,
  DEFAULT_HANDOFF_KEYWORDS,
  SABSMS_AGENT_CONFIGS_COLLECTION,
  agentStoreFor,
  type SabsmsAgentMode,
} from "@/lib/sabsms/agent/store";

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");
  return workspaceId || null;
}

export interface AgentConfigView {
  enabled: boolean;
  mode: SabsmsAgentMode;
  persona: string;
  knowledge: string;
  maxTurnsPerConversation: number;
  handoffKeywords: string[];
}

export type GetAgentConfigResult =
  | { success: true; config: AgentConfigView }
  | { success: false; error: string };

export async function getAgentConfigAction(): Promise<GetAgentConfigResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "view", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const { db } = await connectToDatabase();
  const config = await agentStoreFor(db).getConfig(workspaceId);
  return {
    success: true,
    config: {
      enabled: config.enabled,
      mode: config.mode,
      persona: config.persona,
      knowledge: config.knowledge,
      maxTurnsPerConversation: config.maxTurnsPerConversation,
      handoffKeywords: config.handoffKeywords,
    },
  };
}

export type SaveAgentConfigResult =
  | { success: true; config: AgentConfigView }
  | { success: false; error: string };

export async function saveAgentConfigAction(input: {
  enabled: boolean;
  mode: string;
  persona: string;
  knowledge: string;
  maxTurnsPerConversation: number;
  handoffKeywords: string[];
}): Promise<SaveAgentConfigResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "edit", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const mode: SabsmsAgentMode = input.mode === "auto" ? "auto" : "suggest";
  const maxTurns = Math.min(
    50,
    Math.max(1, Math.floor(Number(input.maxTurnsPerConversation) || 6)),
  );
  const handoffKeywords = (input.handoffKeywords ?? [])
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
  const persona = (input.persona ?? "").slice(0, 4000);
  const knowledge = (input.knowledge ?? "").slice(0, 60_000);

  const { db } = await connectToDatabase();
  await db.collection(SABSMS_AGENT_CONFIGS_COLLECTION).updateOne(
    { workspaceId },
    {
      $set: {
        enabled: Boolean(input.enabled),
        mode,
        persona,
        knowledge,
        maxTurnsPerConversation: maxTurns,
        handoffKeywords:
          handoffKeywords.length > 0
            ? handoffKeywords
            : [...DEFAULT_HANDOFF_KEYWORDS],
        updatedAt: new Date(),
      },
      $setOnInsert: {
        workspaceId,
        allowedTools: [...DEFAULT_ALLOWED_TOOLS],
      },
    },
    { upsert: true },
  );

  const config = await agentStoreFor(db).getConfig(workspaceId);
  return {
    success: true,
    config: {
      enabled: config.enabled,
      mode: config.mode,
      persona: config.persona,
      knowledge: config.knowledge,
      maxTurnsPerConversation: config.maxTurnsPerConversation,
      handoffKeywords: config.handoffKeywords,
    },
  };
}
