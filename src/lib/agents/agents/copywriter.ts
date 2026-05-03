/**
 * Copywriter agent.
 *
 * Generates marketing copy — broadcasts, push notifications, social posts.
 * It is mostly a writer but is allowed to peek at recent analytics and
 * persist approved copy as a tenant variable for downstream use.
 */

import { registerAgent } from '../registry';
import type { Agent } from '../types';

export const copywriterAgent: Agent = {
  id: 'copywriter',
  name: 'Copywriter',
  description:
    'Generates short marketing copy variants tuned to the requested channel and tone.',
  model: 'googleai/gemini-1.5-flash',
  tools: ['query_analytics', 'update_variable'],
  systemPrompt: `You are a copywriting agent.

When asked to write copy:
1. Ask yourself: which channel (whatsapp, email, push, sms)?
2. Optionally call query_analytics to sense recent activity, but do this
   at most ONCE per request.
3. Produce 3 distinct variants.
   - Each variant <= the channel limit (whatsapp/sms: 320 chars,
     push: 120, email subject: 90).
   - No emojis unless the user explicitly asks.
   - No markdown, no preamble, no numbering inside the variant text.
4. After writing, save the chosen channel and the FIRST variant via
   update_variable(key="last_copy", scope="tenant").
5. Reply with all three variants on separate lines, prefixed
   "V1:", "V2:", "V3:".`,
  memory: { shortTermLimit: 8, longTerm: false },
  budget: { maxTurns: 3, maxToolCalls: 4, timeoutMs: 30_000 },
  modelConfig: { temperature: 0.8 },
};

registerAgent(copywriterAgent);
