import 'server-only';

/**
 * SabCRM — shared NON-STREAMING LLM helper.
 *
 * Extracts the provider ladder of `POST /api/sabcrm/ai`
 * (`src/app/api/sabcrm/ai/route.ts`) into a reusable server helper for the
 * features that need a single text completion rather than a streamed chat
 * reply (AI computed fields, NL filtering). The route keeps its own streaming
 * code and imports the model constants from here — one place to bump models.
 *
 * Provider selection (honest, no fakery — mirrors the route exactly):
 * --------------------------------------------------------------------
 *   1. AI Gateway       — if `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN`) is
 *      set, `generateText` from the `ai` SDK with the gateway model slug.
 *      Preferred path (routing / failover / cost tracking).
 *   2. Anthropic direct — else if `ANTHROPIC_API_KEY` is set, the Messages
 *      API over plain `fetch`.
 *   3. OpenAI direct    — else if `OPENAI_API_KEY` is set, Chat Completions
 *      over plain `fetch`.
 *   4. Unconfigured     — else `{ ok:false, error:'AI is not configured…' }`.
 *      We NEVER invent a reply.
 *
 * Model-id rules: gateway slugs are `provider/model` with DOTS for version
 * numbers (`anthropic/claude-sonnet-4.6`); the direct-provider branches use
 * each provider's own native id format. Never throws — every failure becomes
 * `{ ok:false, error }`.
 */

// ---------------------------------------------------------------------------
// Model constants (single source of truth — the chat route imports these)
// ---------------------------------------------------------------------------

/** AI Gateway model slug (`provider/model`, dots in versions). */
export const GATEWAY_MODEL = 'anthropic/claude-sonnet-4.6';
/** Anthropic Messages-API native id (hyphenated by design). */
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
/**
 * OpenAI Chat-Completions native id. Verified against the AI Gateway model
 * list (`openai/gpt-5.5` is the newest mainstream chat model there);
 * OpenAI's native ids use the same dotted form.
 */
export const OPENAI_MODEL = 'gpt-5.5';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SabcrmLlmInput {
  system: string;
  prompt: string;
  /** Output token budget. Default 1024. */
  maxTokens?: number;
}

export type SabcrmLlmResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const DEFAULT_MAX_TOKENS = 1024;

// ---------------------------------------------------------------------------
// Providers (the route's `viaAnthropic` / `viaOpenAI` bodies minus streaming)
// ---------------------------------------------------------------------------

/** AI Gateway via the `ai` SDK (dynamic import like the route's `viaGateway`). */
async function viaGateway(input: SabcrmLlmInput): Promise<SabcrmLlmResult> {
  const { generateText } = await import('ai');
  const result = await generateText({
    model: GATEWAY_MODEL,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  return { ok: true, text: result.text };
}

/** Anthropic Messages API over plain `fetch` (no extra npm dep). */
async function viaAnthropic(
  input: SabcrmLlmInput,
  apiKey: string,
): Promise<SabcrmLlmResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: [{ role: 'user', content: input.prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return {
      ok: false,
      error: `Anthropic request failed (${res.status}). ${detail.slice(0, 200)}`,
    };
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

/** OpenAI Chat Completions over plain `fetch`. */
async function viaOpenAI(
  input: SabcrmLlmInput,
  apiKey: string,
): Promise<SabcrmLlmResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      // `max_tokens` is rejected by current models; the successor param works
      // for every chat model still served.
      max_completion_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return {
      ok: false,
      error: `OpenAI request failed (${res.status}). ${detail.slice(0, 200)}`,
    };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: 'OpenAI returned no text.' };
  return { ok: true, text };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Provider ladder, mirroring `/api/sabcrm/ai` exactly: AI Gateway first, then
 * Anthropic direct, then OpenAI direct, else an honest "AI is not configured"
 * failure. Reads the SAME env keys the route reads. Never throws.
 */
export async function generateSabcrmText(
  input: SabcrmLlmInput,
): Promise<SabcrmLlmResult> {
  try {
    const gatewayKey =
      process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (gatewayKey) return await viaGateway(input);
    if (anthropicKey) return await viaAnthropic(input, anthropicKey);
    if (openaiKey) return await viaOpenAI(input, openaiKey);

    return {
      ok: false,
      error:
        'AI is not configured. Add a provider key (AI_GATEWAY_API_KEY, ' +
        'ANTHROPIC_API_KEY, or OPENAI_API_KEY) to enable AI features.',
    };
  } catch (error) {
    return {
      ok: false,
      error: `AI request failed: ${
        error instanceof Error ? error.message : 'Unexpected error.'
      }`,
    };
  }
}
