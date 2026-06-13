import 'server-only';

/**
 * SabMail LLM gateway client.
 *
 * Mirrors the repo's canonical provider ladder
 * (`src/lib/sabsms/agent/llm.ts` / `src/lib/sabcrm/ai-llm.server.ts`):
 * AI Gateway via the `ai` SDK → Anthropic direct → OpenAI direct → an
 * honest "not configured" failure. Never throws. Keep the model constants
 * in sync with those files when bumping models.
 */

/** AI Gateway model slug (`provider/model`, dots in versions). */
export const SABMAIL_GATEWAY_MODEL = 'anthropic/claude-sonnet-4.6';
/** Anthropic Messages-API native id (hyphenated by design). */
export const SABMAIL_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
/** OpenAI Chat-Completions native id. */
export const SABMAIL_OPENAI_MODEL = 'gpt-5.5';

const DEFAULT_MAX_TOKENS = 1024;

export interface SabmailLlmInput {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export type SabmailLlmResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

async function viaGateway(input: SabmailLlmInput): Promise<SabmailLlmResult> {
  const { generateText } = await import('ai');
  const result = await generateText({
    model: SABMAIL_GATEWAY_MODEL,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  return { ok: true, text: result.text };
}

async function viaAnthropic(input: SabmailLlmInput, apiKey: string): Promise<SabmailLlmResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: SABMAIL_ANTHROPIC_MODEL,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: [{ role: 'user', content: input.prompt }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `Anthropic request failed (${res.status}). ${detail.slice(0, 200)}` };
  }
  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  if (!text) return { ok: false, error: 'Anthropic returned no text.' };
  return { ok: true, text };
}

async function viaOpenAI(input: SabmailLlmInput, apiKey: string): Promise<SabmailLlmResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: SABMAIL_OPENAI_MODEL,
      max_completion_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `OpenAI request failed (${res.status}). ${detail.slice(0, 200)}` };
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: 'OpenAI returned no text.' };
  return { ok: true, text };
}

/**
 * Provider ladder — AI Gateway first, then Anthropic direct, then OpenAI
 * direct, else an honest "not configured" failure. Never throws.
 */
export async function sabmailLlm(input: SabmailLlmInput): Promise<SabmailLlmResult> {
  try {
    const gatewayKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (gatewayKey) return await viaGateway(input);
    if (anthropicKey) return await viaAnthropic(input, anthropicKey);
    if (openaiKey) return await viaOpenAI(input, openaiKey);

    return {
      ok: false,
      error:
        'AI is not configured. Add a provider key (AI_GATEWAY_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY) to enable AI features.',
    };
  } catch (error) {
    return {
      ok: false,
      error: `AI request failed: ${error instanceof Error ? error.message : 'Unexpected error.'}`,
    };
  }
}
