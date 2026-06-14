import 'server-only';

/**
 * WaChat AI copilot prompts.
 *
 * System-prompt builders that encode identity + guardrails for the inbox
 * copilot, following the Claude customer-support guide: a short role/identity
 * in the system prompt, bulk context in the user turn, explicit do/don'ts,
 * PII caution, topic adherence, and a clear escalation path.
 */

export interface BrandVoice {
  businessName?: string;
  tone?: string; // e.g. "warm, concise, professional"
  language?: string; // default reply language, e.g. "English"
  extraGuardrails?: string[];
}

const BASE_GUARDRAILS = [
  'Only state facts grounded in the provided conversation, contact data, or knowledge base. Never invent order numbers, prices, policies, dates, or commitments.',
  'Do not make promises, guarantees, or contractual agreements on behalf of the business.',
  'Strip or avoid echoing sensitive PII (full card numbers, passwords, government IDs) — never request them over chat.',
  'Stay on topics relevant to this business and the customer’s request; politely redirect off-topic asks.',
  'If the request needs a human (refunds beyond policy, complaints, legal, anything you are unsure about), recommend escalation instead of guessing.',
  'Match WhatsApp norms: short, friendly, skimmable. Avoid walls of text. Use the customer’s language when clear.',
];

export function brandSystemPrompt(role: string, brand?: BrandVoice): string {
  const name = brand?.businessName ?? 'the business';
  const tone = brand?.tone ?? 'warm, concise, and professional';
  const lang = brand?.language ? ` Reply in ${brand.language} unless the customer writes in another language.` : '';
  const guardrails = [...BASE_GUARDRAILS, ...(brand?.extraGuardrails ?? [])]
    .map((g, i) => `${i + 1}. ${g}`)
    .join('\n');
  return [
    `You are an AI support copilot for ${name}, working inside a WhatsApp Business inbox.`,
    `${role}`,
    `Voice: ${tone}.${lang}`,
    '',
    'Guardrails:',
    guardrails,
  ].join('\n');
}

/** Render a transcript array into a compact, role-tagged block for the user turn. */
export function renderTranscript(
  messages: Array<{ direction: 'in' | 'out'; text: string; at?: string }>,
  opts?: { customerLabel?: string; agentLabel?: string; max?: number },
): string {
  const cust = opts?.customerLabel ?? 'Customer';
  const agent = opts?.agentLabel ?? 'Business';
  const max = opts?.max ?? 40;
  return messages
    .slice(-max)
    .map((m) => `${m.direction === 'in' ? cust : agent}: ${m.text}`)
    .join('\n');
}
