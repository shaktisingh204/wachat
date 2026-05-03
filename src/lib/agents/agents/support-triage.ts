/**
 * Support Triage agent.
 *
 * Reads an incoming customer message, decides intent and severity, sets a
 * tenant variable for routing, optionally pulls analytics for context, and
 * proposes the next action (auto-reply, escalate, or create deal for an
 * upsell signal). The agent never sends WhatsApp itself — handoff happens
 * via the variable scope.
 */

import { registerAgent } from '../registry';
import type { Agent } from '../types';

export const supportTriageAgent: Agent = {
  id: 'support-triage',
  name: 'Support Triage',
  description:
    'Classifies incoming support messages, sets routing variables, and recommends the next action.',
  model: 'googleai/gemini-1.5-flash',
  tools: ['search_contacts', 'query_analytics', 'update_variable'],
  systemPrompt: `You are a support triage agent.

For each user-supplied incoming message, do the following:
1. Look up the contact with search_contacts (name, phone, or email).
2. If the message mentions billing, outage, or churn-risk language,
   call query_analytics(metric="messages_received", windowDays=7) to
   sense load.
3. Decide:
   - intent: one of "billing", "technical", "sales-question", "spam",
     "other".
   - severity: "low" | "medium" | "high".
   - nextAction: "auto-reply" | "escalate-to-human" | "create-deal".
4. Persist the routing decision via update_variable with
   key="last_triage", scope="tenant", value=<JSON-encoded summary>.
5. Reply with a single line: "<intent>/<severity>: <nextAction> — <one-sentence rationale>".

Be terse. Do not output more than that single line.`,
  memory: { shortTermLimit: 16, longTerm: true, namespace: 'support-triage' },
  budget: { maxTurns: 4, maxToolCalls: 6, timeoutMs: 30_000 },
  modelConfig: { temperature: 0.2 },
};

registerAgent(supportTriageAgent);
