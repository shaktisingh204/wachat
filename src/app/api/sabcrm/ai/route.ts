/**
 * SabCRM — AI Assistant API route (`POST /api/sabcrm/ai`).
 *
 * Twenty ships an AI assistant; this is SabCRM's equivalent backend. It takes a
 * chat transcript and returns the assistant's reply as a streamed text body.
 *
 * Provider selection (honest, no fakery):
 * ---------------------------------------
 *   1. Vercel AI Gateway  — if `AI_GATEWAY_API_KEY` (or `VERCEL_OIDC_TOKEN`) is
 *      set, route through the installed `ai` SDK (`streamText`) with a plain
 *      gateway model id. This is the preferred path.
 *   2. Anthropic direct   — else if `ANTHROPIC_API_KEY` is set, call the
 *      Messages API over plain `fetch` (no extra npm dep) and stream the text.
 *   3. OpenAI direct      — else if `OPENAI_API_KEY` is set, call Chat
 *      Completions over `fetch` and stream the text.
 *   4. Unconfigured       — else return `{ ok:false, error:'AI is not
 *      configured' }` (HTTP 503). We NEVER invent a reply.
 *
 * Everything is wrapped in try/catch; on failure we return a JSON error rather
 * than crashing the route.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChatRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT =
  'You are the SabCRM AI Assistant, embedded in a CRM. Help the user manage ' +
  'opportunities, contacts, companies, notes, and tasks. Be concise, ' +
  'practical, and professional. When asked to draft messages or notes, ' +
  'produce ready-to-use copy.';

// Newest Anthropic models (verified against the gateway model list).
const GATEWAY_MODEL = 'anthropic/claude-sonnet-4.6';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const OPENAI_MODEL = 'gpt-4o';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  const out: ChatMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue;
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (typeof content !== 'string' || content.trim().length === 0) continue;
    if (role === 'user' || role === 'assistant' || role === 'system') {
      out.push({ role, content });
    }
  }
  return out;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** A plain ReadableStream<Uint8Array> emitting `text` as a single chunk. */
function textStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function streamResponse(body: ReadableStream<Uint8Array>): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-sabcrm-ai': 'stream',
    },
  });
}

// ---------------------------------------------------------------------------
// Provider: Vercel AI Gateway via the `ai` SDK
// ---------------------------------------------------------------------------

async function viaGateway(messages: ChatMessage[]): Promise<Response> {
  const { streamText } = await import('ai');
  const result = streamText({
    model: GATEWAY_MODEL,
    system: SYSTEM_PROMPT,
    messages: messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content })),
  });
  // Plain text stream — the client reads the raw body, no UI-stream protocol.
  return result.toTextStreamResponse({
    headers: { 'x-sabcrm-ai': 'stream' },
  });
}

// ---------------------------------------------------------------------------
// Provider: Anthropic Messages API (direct fetch)
// ---------------------------------------------------------------------------

async function viaAnthropic(
  messages: ChatMessage[],
  apiKey: string,
): Promise<Response> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return jsonError(
      `Anthropic request failed (${res.status}). ${detail.slice(0, 200)}`,
      502,
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text =
    (data.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('') || 'No response.';
  return streamResponse(textStream(text));
}

// ---------------------------------------------------------------------------
// Provider: OpenAI Chat Completions (direct fetch)
// ---------------------------------------------------------------------------

async function viaOpenAI(
  messages: ChatMessage[],
  apiKey: string,
): Promise<Response> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
          .filter((m) => m.role !== 'system')
          .map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return jsonError(
      `OpenAI request failed (${res.status}). ${detail.slice(0, 200)}`,
      502,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() || 'No response.';
  return streamResponse(textStream(text));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json().catch(() => null)) as {
      messages?: unknown;
    } | null;

    const messages = sanitizeMessages(body?.messages);
    if (messages.length === 0) {
      return jsonError('No messages provided.', 400);
    }

    const gatewayKey =
      process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (gatewayKey) {
      return await viaGateway(messages);
    }
    if (anthropicKey) {
      return await viaAnthropic(messages, anthropicKey);
    }
    if (openaiKey) {
      return await viaOpenAI(messages, openaiKey);
    }

    // No provider configured — be honest, do not fabricate a reply.
    return jsonError(
      'AI is not configured. Add a provider key (AI_GATEWAY_API_KEY, ' +
        'ANTHROPIC_API_KEY, or OPENAI_API_KEY) to enable the AI Assistant.',
      503,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected error.';
    return jsonError(`AI request failed: ${message}`, 500);
  }
}
