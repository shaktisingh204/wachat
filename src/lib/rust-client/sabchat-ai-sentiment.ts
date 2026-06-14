/**
 * Client for `/v1/sabchat/ai/sentiment/*` — classify the sentiment of a raw
 * string, a stored message, or roll a churn-risk score across a whole
 * conversation. Owned by the `sabchat-ai-sentiment` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface SentimentResult {
  label?: string;
  score?: number;
  [k: string]: unknown;
}

export interface ConversationSentiment {
  scored: number;
  churnRisk: number;
  [k: string]: unknown;
}

export const sabchatAiSentimentApi = {
  classify: (body: { text: string }) =>
    rustFetch<SentimentResult>('/v1/sabchat/ai/sentiment/classify', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  message: (body: { messageId: string }) =>
    rustFetch<SentimentResult>('/v1/sabchat/ai/sentiment/message', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  conversation: (body: { conversationId: string }) =>
    rustFetch<ConversationSentiment>('/v1/sabchat/ai/sentiment/conversation', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
