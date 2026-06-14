'use server';

/**
 * Meta Suite — Unified Social Inbox AI helpers.
 *
 * AI-suggested replies for the Facebook inbox, through the repo's canonical
 * provider ladder (`wachatLlm`). Degrades safely (never throws).
 */

import { wachatLlm } from '@/lib/wachat/ai/client';

export async function suggestInboxReply(input: {
  pageName: string;
  customerName?: string;
  transcript: string;
}): Promise<{ reply?: string; error?: string }> {
  if (!input.transcript.trim()) return { error: 'No conversation to reply to yet.' };

  const system =
    'You are a friendly, professional customer-support agent replying in a ' +
    'Facebook Page inbox. Write a concise, genuinely helpful reply (1–3 ' +
    'sentences). Match the customer’s language. Output ONLY the reply text — ' +
    'no quotes, no preamble, no labels.';

  const prompt =
    `You reply as the Page "${input.pageName}".` +
    (input.customerName ? ` The customer is ${input.customerName}.` : '') +
    `\n\nConversation (oldest first):\n${input.transcript}\n\n` +
    'Write the next reply from the Page.';

  const res = await wachatLlm({ system, prompt, tier: 'fast', maxTokens: 300 });
  if (!res.ok) return { error: res.error };
  const reply = res.text.trim().replace(/^["'`]+|["'`]+$/g, '').trim();
  return reply ? { reply } : { error: 'No reply was generated. Try again.' };
}
