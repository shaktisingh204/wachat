import 'server-only';

/**
 * WaChat LLM gateway client.
 *
 * Mirrors the repo's canonical provider ladder (`src/lib/sabmail/ai.ts`,
 * `src/lib/sabsms/agent/llm.ts`): AI Gateway via the `ai` SDK → Anthropic
 * direct → OpenAI direct → an honest "not configured" failure. Never throws.
 *
 * Two model tiers, per the Claude customer-support guidance:
 *   - `smart`  → Claude Opus 4.8: generation/reasoning (templates, flows,
 *                campaign optimization, post copy).
 *   - `fast`   → Claude Haiku 4.5: latency-sensitive inbox loops (draft reply,
 *                sentiment, intent routing, translation).
 *
 * Keep the model constants in sync with src/lib/sabmail/ai.ts when bumping.
 */

export type WaModelTier = 'smart' | 'fast';

/** AI Gateway model slugs (`provider/model`, dots in versions). */
const GATEWAY_MODEL: Record<WaModelTier, string> = {
  smart: 'anthropic/claude-opus-4.8',
  fast: 'anthropic/claude-haiku-4.5',
};
/** Anthropic Messages-API native ids (hyphenated by design). */
const ANTHROPIC_MODEL: Record<WaModelTier, string> = {
  smart: 'claude-opus-4-8',
  fast: 'claude-haiku-4-5-20251001',
};
/** OpenAI fallback ids. */
const OPENAI_MODEL: Record<WaModelTier, string> = {
  smart: 'gpt-5.5',
  fast: 'gpt-5.5-mini',
};

const DEFAULT_MAX_TOKENS = 1024;

export interface WaLlmInput {
  system: string;
  prompt: string;
  tier?: WaModelTier;
  maxTokens?: number;
  /** Pre-fill the assistant turn (e.g. force JSON with `{`). */
  prefill?: string;
}

export type WaLlmResult = { ok: true; text: string } | { ok: false; error: string };

function gatewayKey() {
  return process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
}

/* --------------------------------------------------------------- text --- */

async function viaGateway(input: WaLlmInput): Promise<WaLlmResult> {
  const { generateText } = await import('ai');
  const result = await generateText({
    model: GATEWAY_MODEL[input.tier ?? 'fast'],
    system: input.system,
    prompt: input.prefill ? `${input.prompt}\n\n${input.prefill}` : input.prompt,
    maxOutputTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  const text = input.prefill ? input.prefill + result.text : result.text;
  return { ok: true, text };
}

async function viaAnthropic(input: WaLlmInput, apiKey: string): Promise<WaLlmResult> {
  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: input.prompt },
  ];
  if (input.prefill) messages.push({ role: 'assistant', content: input.prefill });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL[input.tier ?? 'fast'],
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `Anthropic request failed (${res.status}). ${detail.slice(0, 200)}` };
  }
  const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  if (!text) return { ok: false, error: 'Anthropic returned no text.' };
  return { ok: true, text: (input.prefill ?? '') + text };
}

async function viaOpenAI(input: WaLlmInput, apiKey: string): Promise<WaLlmResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL[input.tier ?? 'fast'],
      max_completion_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt },
        ...(input.prefill ? [{ role: 'assistant', content: input.prefill }] : []),
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `OpenAI request failed (${res.status}). ${detail.slice(0, 200)}` };
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return { ok: false, error: 'OpenAI returned no text.' };
  return { ok: true, text: (input.prefill ?? '') + text };
}

/**
 * Provider ladder — AI Gateway → Anthropic direct → OpenAI direct, else an
 * honest "not configured" failure. Never throws.
 */
export async function wachatLlm(input: WaLlmInput): Promise<WaLlmResult> {
  try {
    if (gatewayKey()) return await viaGateway(input);
    if (process.env.ANTHROPIC_API_KEY) return await viaAnthropic(input, process.env.ANTHROPIC_API_KEY);
    if (process.env.OPENAI_API_KEY) return await viaOpenAI(input, process.env.OPENAI_API_KEY);
    return {
      ok: false,
      error:
        'AI is not configured. Add a provider key (AI_GATEWAY_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY) to enable WaChat AI features.',
    };
  } catch (error) {
    return {
      ok: false,
      error: `AI request failed: ${error instanceof Error ? error.message : 'Unexpected error.'}`,
    };
  }
}

/** Parse a JSON object out of an LLM reply, tolerating fences/prose. */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/* ----------------------------------------------------------- streaming --- */

/**
 * Stream text deltas as an async iterable of strings. Prefers the AI Gateway
 * (`streamText`); falls back to Anthropic native SSE. Yields nothing and
 * throws on no-provider so callers can surface a clean error frame.
 */
export async function* wachatLlmStream(input: WaLlmInput): AsyncGenerator<string> {
  if (gatewayKey()) {
    const { streamText } = await import('ai');
    const result = streamText({
      model: GATEWAY_MODEL[input.tier ?? 'fast'],
      system: input.system,
      prompt: input.prompt,
      maxOutputTokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
    });
    for await (const delta of result.textStream) yield delta;
    return;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL[input.tier ?? 'fast'],
        max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
        system: input.system,
        messages: [{ role: 'user', content: input.prompt }],
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Anthropic stream failed (${res.status}).`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const evt = JSON.parse(payload) as {
            type?: string;
            delta?: { type?: string; text?: string };
          };
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta' && evt.delta.text) {
            yield evt.delta.text;
          }
        } catch {
          // ignore keep-alive / non-JSON frames
        }
      }
    }
    return;
  }

  throw new Error('AI is not configured. Add AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY.');
}
