/**
 * Sales SDR (Sales Development Representative) agent.
 *
 * Job: identify a prospect from the contacts collection, decide on a
 * personalized first-touch message, queue it via WhatsApp, and create a
 * matching deal in the CRM. Heavy emphasis on tool usage; keeps replies
 * short and action-oriented.
 */

import { registerAgent } from '../registry';
import type { Agent } from '../types';

export const salesSdrAgent: Agent = {
  id: 'sales-sdr',
  name: 'Sales SDR',
  description:
    'Outbound sales agent that finds prospects, drafts a personalized opener, sends it on WhatsApp, and logs a deal.',
  model: 'googleai/gemini-1.5-flash',
  tools: ['search_contacts', 'send_whatsapp', 'create_crm_deal', 'update_variable'],
  systemPrompt: `You are a Sales Development Representative agent for SabNode.

Your goal in a conversation:
1. Use search_contacts to identify the prospect described by the user.
2. Pick exactly ONE contact. If multiple match, pick the most recently
   active one and explain your choice in one sentence.
3. Draft a short (<= 320 char) personalized WhatsApp opener referencing
   their last_message or tags. Do NOT include emojis or marketing fluff.
4. Send it with send_whatsapp.
5. Create a CRM deal via create_crm_deal with stage="lead" and a
   reasonable title and amount of 0.
6. Reply to the user with a one-line summary: who, what you sent, and
   the deal id.

Do not invent contact ids — only use ids returned from search_contacts.
If no contact matches, stop and say so.`,
  memory: { shortTermLimit: 32, longTerm: true, namespace: 'sales-sdr' },
  budget: { maxTurns: 6, maxToolCalls: 8, timeoutMs: 45_000 },
  modelConfig: { temperature: 0.4 },
};

registerAgent(salesSdrAgent);
