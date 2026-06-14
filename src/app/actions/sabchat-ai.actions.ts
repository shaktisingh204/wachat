'use server';

/**
 * SabChat AI copilot server actions — project-scoped over the Rust AI crates
 * (`/v1/sabchat/ai/*`): reply drafting, conversation summary, sentiment /
 * churn-risk, translation, and the KB-grounded resolve bot. Every call runs
 * inside `runWithRustTenant(workspaceId, …)`.
 */

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import { getErrorMessage } from '@/lib/utils';
import type { ResolveBotSource } from '@/lib/rust-client/sabchat-ai-resolve-bot';
import type { CopilotSuggestedAction } from '@/lib/rust-client/sabchat-ai-copilot';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

type Err = { ok: false; error: string };

export async function aiDraftReply(
  conversationId: string,
  hint?: string,
): Promise<{ ok: true; draft: string } | Err> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatAiCopilot.draft({ conversationId, hint }),
    );
    return { ok: true, draft: res.draft };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function aiSummarize(
  conversationId: string,
): Promise<{ ok: true; summary: string } | Err> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatAiCopilot.summarize({ conversationId }),
    );
    return { ok: true, summary: res.summary };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function aiConversationSentiment(
  conversationId: string,
): Promise<{ ok: true; churnRisk: number; scored: number } | Err> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatAiSentiment.conversation({ conversationId }),
    );
    return { ok: true, churnRisk: res.churnRisk, scored: res.scored };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function aiTranslateText(
  text: string,
  targetLang: string,
): Promise<{ ok: true; translated: string } | Err> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatAiTranslate.text({ text, targetLang }),
    );
    return { ok: true, translated: res.translated };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function aiResolveBotAnswer(
  inboxId: string,
  conversationId: string,
  question: string,
): Promise<
  | { ok: true; answer: string; confidence: number; escalate: boolean; sources: ResolveBotSource[] }
  | Err
> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatAiResolveBot.answer({ inboxId, conversationId, question }),
    );
    return {
      ok: true,
      answer: res.answer,
      confidence: res.confidence,
      escalate: res.escalate,
      sources: res.sources,
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function aiSuggestActions(
  conversationId: string,
): Promise<{ ok: true; actions: CopilotSuggestedAction[] } | Err> {
  try {
    const res = await scoped(() =>
      rustClient.sabchatAiCopilot.suggestActions({ conversationId }),
    );
    return { ok: true, actions: res.actions };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

export async function aiWrapUp(
  conversationId: string,
): Promise<{ ok: true; note: string } | Err> {
  try {
    const res = await scoped(() => rustClient.sabchatAiCopilot.wrapUp({ conversationId }));
    return { ok: true, note: res.note };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}
