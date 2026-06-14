/**
 * Client for `/v1/sabchat/ai/resolve-bot/*` — the knowledge-grounded
 * deflection bot: answer a visitor question from the KB (with confidence +
 * sources + escalate flag) and optionally auto-post the reply. Owned by the
 * `sabchat-ai-resolve-bot` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface ResolveBotSource {
  kind: string;
  id: string;
  title: string;
}

export interface ResolveBotAnswer {
  answer: string;
  confidence: number;
  sources: ResolveBotSource[];
  escalate: boolean;
}

export interface ResolveBotAutoReply extends ResolveBotAnswer {
  posted: boolean;
  messageId?: string;
}

export const sabchatAiResolveBotApi = {
  answer: (body: { inboxId: string; conversationId: string; question: string }) =>
    rustFetch<ResolveBotAnswer>('/v1/sabchat/ai/resolve-bot/answer', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  autoReply: (body: { inboxId: string; conversationId: string }) =>
    rustFetch<ResolveBotAutoReply>('/v1/sabchat/ai/resolve-bot/auto-reply', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
