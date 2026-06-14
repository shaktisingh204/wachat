import { NextRequest } from 'next/server';

import { getCachedSession } from '@/lib/server-cache';
import { getProjectById } from '@/app/actions/project.actions';
import { wachatLlmStream } from '@/lib/wachat/ai/client';
import { brandSystemPrompt, renderTranscript } from '@/lib/wachat/ai/prompts';
import type { BrandVoiceInput, TranscriptTurn } from '@/lib/wachat/ai/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * WaChat AI copilot — streaming endpoint (SSE).
 *
 * POST { projectId, mode, transcript, brand?, instruction? } → text/event-stream
 * of `data: {"delta": "..."}` frames, terminated by `data: {"done": true}`.
 * Powers the live "AI typing" reply-draft / summarize experience in the inbox
 * copilot dock. Auth: session required; project must belong to the user.
 */

type Mode = 'draft' | 'summary';

interface Body {
  projectId?: string;
  mode?: Mode;
  transcript?: TranscriptTurn[];
  brand?: BrandVoiceInput;
  instruction?: string;
}

function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user?._id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { projectId, transcript } = body;
  if (!projectId) return new Response('Missing projectId', { status: 400 });
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return new Response('Missing transcript', { status: 400 });
  }

  // getProjectById is user-scoped → null means no access.
  const project = await getProjectById(projectId).catch(() => null);
  if (!project) return new Response('Forbidden', { status: 403 });

  const mode: Mode = body.mode === 'summary' ? 'summary' : 'draft';
  const role =
    mode === 'summary'
      ? 'Summarize the conversation for an agent taking it over: a short paragraph, then the single most useful next action.'
      : 'Draft one short, ready-to-send WhatsApp reply for the human agent. No preamble — just the message.';
  const system = brandSystemPrompt(role, body.brand);
  const prompt = [
    'Conversation so far:',
    renderTranscript(transcript),
    '',
    body.instruction ? `Agent instruction: ${body.instruction}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const abort = () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener('abort', abort);
      try {
        controller.enqueue(encoder.encode(`: ping\n\n`));
        for await (const delta of wachatLlmStream({ system, prompt, tier: mode === 'summary' ? 'fast' : 'fast', maxTokens: 700 })) {
          if (req.signal.aborted) break;
          controller.enqueue(encoder.encode(sse({ delta })));
        }
        controller.enqueue(encoder.encode(sse({ done: true })));
      } catch (err) {
        controller.enqueue(
          encoder.encode(sse({ error: err instanceof Error ? err.message : 'AI stream failed.' })),
        );
      } finally {
        req.signal.removeEventListener('abort', abort);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
