/**
 * Client for `/v1/sabchat/ai/translate/*` — translate a raw string, detect a
 * language, or translate a stored message in place. Owned by the
 * `sabchat-ai-translate` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface TranslateTextResult {
  translated: string;
  detectedSourceLang?: string;
  [k: string]: unknown;
}

export interface TranslateMessageResult {
  messageId: string;
  translated: string;
  detectedSourceLang: string;
}

export interface DetectResult {
  lang: string;
  confidence?: number;
  [k: string]: unknown;
}

export const sabchatAiTranslateApi = {
  text: (body: { text: string; targetLang: string; sourceLang?: string }) =>
    rustFetch<TranslateTextResult>('/v1/sabchat/ai/translate/text', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  detect: (body: { text: string }) =>
    rustFetch<DetectResult>('/v1/sabchat/ai/translate/detect', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  message: (body: { messageId: string; targetLang: string }) =>
    rustFetch<TranslateMessageResult>('/v1/sabchat/ai/translate/message', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
