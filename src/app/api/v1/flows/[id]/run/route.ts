/**
 * POST /api/v1/flows/{id}/run — trigger a one-shot SabFlow run.
 *
 * Body (all optional):
 *   {
 *     input?: string,                 // user input fed to the entry block
 *     variables?: Record<string,string>, // initial variable bag
 *     idempotency_key?: string
 *   }
 *
 * Auth: API key with `flows:write`.
 *
 * The flow must belong to the calling tenant (`SabFlowDoc.userId === ctx.tenantId`).
 * Other tenants get a 404 (rather than 403) to avoid leaking flow IDs.
 */

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';

import {
  ApiError,
  withApiV1,
  withIdempotency,
} from '@/lib/api-platform';
import { getSabFlowById } from '@/lib/sabflow/db';
import { executeFlow } from '@/lib/sabflow/engine';
import type { SessionState } from '@/lib/sabflow/engine/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ── Body ───────────────────────────────────────────────────────────────── */

interface RunBody {
  input?: unknown;
  variables?: unknown;
  idempotency_key?: unknown;
}

function parseBody(raw: unknown): {
  input?: string;
  variables: Record<string, string>;
  idempotencyKey?: string;
} {
  if (raw === undefined || raw === null) {
    return { variables: {} };
  }
  if (typeof raw !== 'object') {
    throw ApiError.validationFailed([{ path: 'body', message: 'Body must be a JSON object' }]);
  }
  const b = raw as RunBody;
  const errors: Array<{ path: string; message: string }> = [];

  let input: string | undefined;
  if (b.input !== undefined) {
    if (typeof b.input !== 'string') {
      errors.push({ path: 'input', message: 'Must be a string' });
    } else {
      input = b.input;
    }
  }

  let variables: Record<string, string> = {};
  if (b.variables !== undefined) {
    if (!b.variables || typeof b.variables !== 'object') {
      errors.push({ path: 'variables', message: 'Must be an object of string values' });
    } else {
      for (const [k, v] of Object.entries(b.variables as Record<string, unknown>)) {
        if (typeof v !== 'string') {
          errors.push({ path: `variables.${k}`, message: 'Must be a string' });
        } else {
          variables[k] = v;
        }
      }
    }
  }

  if (errors.length) throw ApiError.validationFailed(errors);

  return {
    input,
    variables,
    idempotencyKey: typeof b.idempotency_key === 'string' ? b.idempotency_key : undefined,
  };
}

/* ── Handler ────────────────────────────────────────────────────────────── */

export const POST = withApiV1<{ id: string }>(
  async (req: NextRequest, { ctx, requestId, params }) => {
    let raw: unknown = null;
    if (req.headers.get('content-length') !== '0' && req.body) {
      try {
        raw = await req.json();
      } catch {
        // Empty body is fine; anything else is an error.
        const txt = await req.text().catch(() => '');
        if (txt.trim().length) {
          throw ApiError.validationFailed([{ path: 'body', message: 'Invalid JSON' }]);
        }
      }
    }
    const parsed = parseBody(raw);
    const flowId = params.id;
    if (!flowId) throw ApiError.notFound('Flow id missing');

    const idempotencyKey =
      req.headers.get('idempotency-key') ?? parsed.idempotencyKey ?? null;

    const out = await withIdempotency(ctx.tenantId, idempotencyKey, raw ?? {}, async () => {
      const flow = await getSabFlowById(flowId);
      if (!flow || flow.userId !== ctx.tenantId) {
        throw ApiError.notFound(`Flow ${flowId} not found`);
      }
      if (!flow.groups || flow.groups.length === 0) {
        throw ApiError.validationFailed([
          { path: 'flow', message: 'Flow has no groups to execute' },
        ]);
      }

      const session: SessionState = {
        flowId,
        currentGroupId: flow.groups[0].id,
        currentBlockIndex: 0,
        variables: parsed.variables,
        history: [],
      };

      const { result, updatedSession } = await executeFlow(flow, session, parsed.input);

      return {
        status: 200,
        body: {
          flow_id: flowId,
          completed: result.isCompleted,
          messages: result.messages,
          next_input_request: result.nextInputRequest ?? null,
          variables: updatedSession.variables,
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
  { scope: 'flows:write' },
);
