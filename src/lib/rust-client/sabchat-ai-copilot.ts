/**
 * Client for `/v1/sabchat/ai/copilot/*` — agent-side AI copilot: reply
 * drafting, conversation summary, suggested actions, and wrap-up notes.
 * Owned by the `sabchat-ai-copilot` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface CopilotDraft {
  draft: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface CopilotSummary {
  summary: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface CopilotSuggestedAction {
  kind: string;
  title: string;
  payload: unknown;
}

export const sabchatAiCopilotApi = {
  draft: (body: { conversationId: string; hint?: string }) =>
    rustFetch<CopilotDraft>('/v1/sabchat/ai/copilot/draft', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  summarize: (body: { conversationId: string }) =>
    rustFetch<CopilotSummary>('/v1/sabchat/ai/copilot/summarize', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  suggestActions: (body: { conversationId: string }) =>
    rustFetch<{ actions: CopilotSuggestedAction[] }>(
      '/v1/sabchat/ai/copilot/suggest-actions',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  wrapUp: (body: { conversationId: string }) =>
    rustFetch<{ note: string }>('/v1/sabchat/ai/copilot/wrap-up', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
