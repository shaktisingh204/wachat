/**
 * SabSMS AI agent — worker-safe LLM gateway client (V2.12).
 *
 * Mirrors the app-wide provider ladder of
 * `src/lib/sabcrm/ai-llm.server.ts` (the repo's canonical LLM gateway:
 * AI Gateway via the `ai` SDK → Anthropic direct → OpenAI direct →
 * honest "not configured" failure) — but WITHOUT `import 'server-only'`,
 * because the agent runtime executes inside the `sabsms-events` PM2
 * worker (tsx), where `server-only` is a poison pill. The model
 * constants are duplicated deliberately; keep them in sync with
 * `ai-llm.server.ts` when bumping models.
 *
 * Every call site takes an injectable `SabsmsLlmClient` so unit tests
 * and the eval harness (`scripts/sabsms-agent-eval.mjs`) run with a
 * deterministic mock and never touch the network.
 *
 * Worker-safe: relative imports only, no `server-only`, no `@/` paths.
 */

// ─── Model constants (sync with src/lib/sabcrm/ai-llm.server.ts) ──────────

/** AI Gateway model slug (`provider/model`, dots in versions). */
export const SABSMS_GATEWAY_MODEL = 'anthropic/claude-sonnet-4.6';
/** Anthropic Messages-API native id (hyphenated by design). */
export const SABSMS_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
/** OpenAI Chat-Completions native id. */
export const SABSMS_OPENAI_MODEL = 'gpt-5.5';

const DEFAULT_MAX_TOKENS = 1024;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SabsmsLlmInput {
  system: string;
  prompt: string;
  /** Output token budget. Default 1024. */
  maxTokens?: number;
}

export type SabsmsLlmResult =
  | { ok: true; text: string; promptTokens?: number; completionTokens?: number }
  | { ok: false; error: string };

/** Injectable gateway surface — mock this in tests / the eval harness. */
export type SabsmsLlmClient = (input: SabsmsLlmInput) => Promise<SabsmsLlmResult>;

// ─── Providers (ladder bodies mirror ai-llm.server.ts exactly) ────────────

async function viaGateway(input: SabsmsLlmInput): Promise<SabsmsLlmResult> {
  // Dynamic import like the sabcrm route's `viaGateway` — worker
  // bootstraps that never hit AI never load the `ai` SDK at all.
  const { generateText } = await import('ai');
  const result = await generateText({
    model: SABSMS_GATEWAY_MODEL,
    system: input.system,
    prompt: input.prompt,
    maxOutputTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  return {
    ok: true,
    text: result.text,
    promptTokens: result.usage?.inputTokens,
    completionTokens: result.usage?.outputTokens,
  };
}

async function viaAnthropic(
  input: SabsmsLlmInput,
  apiKey: string,
): Promise<SabsmsLlmResult> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: SABSMS_ANTHROPIC_MODEL,
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
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  if (!text) return { ok: false, error: 'Anthropic returned no text.' };
  return {
    ok: true,
    text,
    promptTokens: data.usage?.input_tokens,
    completionTokens: data.usage?.output_tokens,
  };
}

async function viaOpenAI(
  input: SabsmsLlmInput,
  apiKey: string,
): Promise<SabsmsLlmResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: SABSMS_OPENAI_MODEL,
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
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: 'OpenAI returned no text.' };
  return {
    ok: true,
    text,
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  };
}

// ─── Entry point ───────────────────────────────────────────────────────────

/**
 * Provider ladder — AI Gateway first, then Anthropic direct, then
 * OpenAI direct, else an honest "not configured" failure. Reads the
 * SAME env keys the sabcrm gateway reads. Never throws.
 */
export const defaultSabsmsLlmClient: SabsmsLlmClient = async (input) => {
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
};

/**
 * Strip markdown code fences and parse the first JSON object in an LLM
 * reply. Models wrap JSON in ```json fences no matter how firmly you
 * tell them not to — same cleanup the `imports/ai-mapping` route does.
 */
export function parseLlmJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
