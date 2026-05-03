/**
 * POST /api/v1/agents/{id}/run — invoke an AI agent (Impl 4).
 *
 * Body:
 *   {
 *     input: string,                  // user prompt
 *     history?: Array<{ role: 'user'|'model', content: string }>,
 *     model?: string,                 // override the agent's default model
 *     idempotency_key?: string
 *   }
 *
 * Auth: API key with `*` scope (no agent-specific scope is defined yet —
 * we deliberately gate behind the wildcard so platform-level reviews can
 * promote it without breaking call sites).
 *
 * Returns: 200 { run_id, output, transcript, tool_calls, turns, error? }
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import {
  ApiError,
  withApiV1,
  withIdempotency,
} from '@/lib/api-platform';
import { runAgent } from '@/lib/agents/runner';
import { getAgent } from '@/lib/agents/registry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RunBody {
  input?: unknown;
  history?: unknown;
  model?: unknown;
  meta?: unknown;
  idempotency_key?: unknown;
}

function parseBody(raw: unknown): {
  input: string;
  history?: Array<{ role: 'user' | 'model'; content: string }>;
  model?: string;
  meta?: Record<string, unknown>;
  idempotencyKey?: string;
} {
  if (!raw || typeof raw !== 'object') {
    throw ApiError.validationFailed([{ path: 'body', message: 'Body must be a JSON object' }]);
  }
  const b = raw as RunBody;
  const errors: Array<{ path: string; message: string }> = [];

  if (typeof b.input !== 'string' || b.input.trim().length === 0) {
    errors.push({ path: 'input', message: 'Required non-empty string' });
  }

  let history: Array<{ role: 'user' | 'model'; content: string }> | undefined;
  if (b.history !== undefined) {
    if (!Array.isArray(b.history)) {
      errors.push({ path: 'history', message: 'Must be an array' });
    } else {
      history = [];
      for (let i = 0; i < b.history.length; i++) {
        const m = b.history[i] as { role?: unknown; content?: unknown };
        if (
          !m ||
          (m.role !== 'user' && m.role !== 'model') ||
          typeof m.content !== 'string'
        ) {
          errors.push({
            path: `history[${i}]`,
            message: "Expected { role: 'user'|'model', content: string }",
          });
        } else {
          history.push({ role: m.role, content: m.content });
        }
      }
    }
  }

  if (errors.length) throw ApiError.validationFailed(errors);

  return {
    input: (b.input as string).trim(),
    history,
    model: typeof b.model === 'string' ? b.model : undefined,
    meta:
      b.meta && typeof b.meta === 'object' ? (b.meta as Record<string, unknown>) : undefined,
    idempotencyKey: typeof b.idempotency_key === 'string' ? b.idempotency_key : undefined,
  };
}

export const POST = withApiV1<{ id: string }>(
  async (req: NextRequest, { ctx, requestId, params }) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON' }]);
    }
    const parsed = parseBody(raw);
    const agentId = params.id;
    if (!agentId) throw ApiError.notFound('Agent id missing');

    if (!getAgent(agentId)) {
      throw ApiError.notFound(`Agent ${agentId} not found`);
    }

    const idempotencyKey =
      req.headers.get('idempotency-key') ?? parsed.idempotencyKey ?? null;

    const out = await withIdempotency(ctx.tenantId, idempotencyKey, raw, async () => {
      const run = await runAgent(agentId, parsed.input, {
        tenantId: ctx.tenantId,
        history: parsed.history,
        model: parsed.model,
        meta: parsed.meta,
      });
      return {
        status: 200,
        body: {
          run_id: run.runId,
          agent_id: run.agentId,
          output: run.output,
          transcript: run.transcript,
          tool_calls: run.toolCalls,
          turns: run.turns,
          error: run.error,
          budget_exceeded: run.budgetExceeded ?? false,
          started_at: run.startedAt,
          finished_at: run.finishedAt,
        },
      };
    });

    return new NextResponse(out.body, {
      status: out.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-request-id': requestId,
        ...out.headers,
      },
    });
  },
  { scope: '*' },
);
