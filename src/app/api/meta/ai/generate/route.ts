/**
 * Meta Suite — AI caption generation (`POST /api/meta/ai/generate`).
 *
 * Streams Facebook post copy token-by-token as a plain `text/plain` body, so the
 * Studio composer can render it live. Reuses the repo's canonical provider
 * ladder (`wachatLlmStream`: AI Gateway → Anthropic → OpenAI → honest 503).
 */

import { wachatLlmStream } from '@/lib/wachat/ai/client';
import {
  CAPTION_SYSTEM,
  buildCaptionPrompt,
  type CaptionInput,
} from '@/lib/meta/ai/prompts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: Partial<CaptionInput> | null = null;
  try {
    body = (await request.json().catch(() => null)) as Partial<CaptionInput> | null;
  } catch {
    body = null;
  }

  const brief = (body?.brief ?? '').toString().trim();
  if (!brief) return jsonError('Describe what the post should be about.', 400);

  const input: CaptionInput = {
    brief,
    tone: body?.tone,
    goal: body?.goal,
    pageName: body?.pageName,
    includeEmoji: body?.includeEmoji ?? true,
    includeHashtags: body?.includeHashtags ?? false,
    includeCta: body?.includeCta ?? true,
    variantHint: body?.variantHint,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const delta of wachatLlmStream({
          system: CAPTION_SYSTEM,
          prompt: buildCaptionPrompt(input),
          tier: 'smart',
          maxTokens: 600,
        })) {
          controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (e) {
        // Surface a clean inline error the client can show; the stream has
        // already started so we cannot change the status code here.
        const msg = e instanceof Error ? e.message : 'AI request failed.';
        controller.enqueue(encoder.encode(`\n\n[error] ${msg}`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-meta-ai': 'stream',
    },
  });
}
