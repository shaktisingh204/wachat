/**
 * POST /api/v1/flows/[flowId]/run
 *
 * External-automation endpoint: trigger a fresh run of a SabFlow.  Returns
 * the created execution row immediately; the run completes asynchronously
 * but synchronously enough to surface most short flows' output in the same
 * response.
 *
 * Body (all optional):
 *   {
 *     "variables":   { "name": "Ada" },         // seed flow variables
 *     "startBlockId": "abc...",                  // optional entry point
 *     "wait":         true                        // block until completion (default false)
 *   }
 *
 * Auth:  Authorization: Bearer sk_live_…  (see lib/sabflow/apiKeys/auth.ts)
 *
 * Returns:
 *   200 { executionId, status, output?, error? }   — `wait=false` (default)
 *   200 { executionId, status: 'success', output } — `wait=true` and ran ok
 *   500 { executionId, status: 'error', error }    — engine threw
 *   401 { error }                                  — bad / missing key
 *   404 { error }                                  — flow not found / not yours
 */

import { NextResponse, type NextRequest } from 'next/server';
import { authenticateApiRequest } from '@/lib/sabflow/apiKeys/auth';
import {
  createExecutionHistory,
  getSabFlowById,
  updateExecutionHistory,
} from '@/lib/sabflow/db';
import { executeFlow } from '@/lib/sabflow/engine';
import { ConcurrencyLimitError } from '@/lib/sabflow/engine/executeFlow';
import type { SessionState } from '@/lib/sabflow/engine/types';
import { sendFailureAlert } from '@/lib/sabflow/alerting/failureAlert';
import { getNotificationSettings } from '@/lib/sabflow/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ flowId: string }> },
) {
  const auth = await authenticateApiRequest(req);
  if (auth instanceof NextResponse) return auth;

  const { flowId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    variables?: Record<string, unknown>;
    startBlockId?: string;
    wait?: boolean;
  };

  const flow = await getSabFlowById(flowId);
  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }
  if (flow.userId !== auth.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  /* Locate the starting block (defaults to the first block of the first group). */
  let startGroupId = flow.groups[0]?.id;
  let startIndex = 0;
  if (body.startBlockId) {
    outer: for (const group of flow.groups) {
      for (let i = 0; i < group.blocks.length; i++) {
        if (group.blocks[i].id === body.startBlockId) {
          startGroupId = group.id;
          startIndex = i;
          break outer;
        }
      }
    }
  }
  if (!startGroupId) {
    return NextResponse.json(
      { error: 'Flow has no executable blocks' },
      { status: 400 },
    );
  }

  /* Seed the session with the supplied variables (stringified). */
  const seededVars: Record<string, string> = {};
  for (const v of flow.variables ?? []) {
    if (v.defaultValue !== undefined) seededVars[v.name] = String(v.defaultValue);
    else if (v.value !== undefined) seededVars[v.name] = String(v.value);
  }
  for (const [k, v] of Object.entries(body.variables ?? {})) {
    seededVars[k] = v === null || v === undefined ? '' : String(v);
  }

  const session: SessionState = {
    flowId,
    currentGroupId: startGroupId,
    currentBlockIndex: startIndex,
    variables: seededVars,
    history: [],
  };

  const created = await createExecutionHistory({
    flowId,
    sessionId: `api:${Date.now()}`,
    triggerMode: 'manual',
    startedAt: new Date(),
    status: 'running',
    nodeCount: 0,
    startNodeId: body.startBlockId,
  });

  const startedAt = Date.now();
  console.log(
    `[SABFLOW V1 RUN] flow=${flowId} execution=${created.id} user=${auth.userId}`,
  );

  const runAndFinalise = async () => {
    try {
      const result = await executeFlow(flow, session);
      const durationMs = Date.now() - startedAt;
      await updateExecutionHistory(created.id, {
        finishedAt: new Date(),
        status: result.result.isCompleted ? 'success' : 'running',
        executionTimeMs: durationMs,
        nodeCount: result.updatedSession.history.length,
        variables: result.result.updatedVariables as Record<string, unknown>,
        // Step-22 trace — map ExecutionStep → ExecutionHistoryNode so the
        // replay view renders per-block input/output/duration.
        nodes: result.updatedSession.history
          .filter((step) => step.blockId !== '__end__')
          .map((step) => ({
            blockId: step.blockId,
            blockType: step.blockType,
            status: step.status ?? 'success',
            startedAt: step.startedAt,
            finishedAt: step.startedAt
              ? new Date((step.startedAt as Date).getTime() + (step.durationMs ?? 0))
              : undefined,
            durationMs: step.durationMs,
            input: step.input,
            output: step.output,
            error: step.error,
          })),
      });
      return { ok: true as const, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err instanceof ConcurrencyLimitError ? 'cancelled' : 'error';
      await updateExecutionHistory(created.id, {
        finishedAt: new Date(),
        status,
        error: message,
      });
      console.error(
        `[SABFLOW V1 RUN] error execution=${created.id}:`,
        err,
      );

      // Best-effort failure alert.  Errors here are swallowed — the alert
      // is a notification, not part of the contract.
      if (status === 'error') {
        try {
          const notifSettings = await getNotificationSettings(flowId);
          await sendFailureAlert(
            flow,
            { ...created, status: 'error', error: message, finishedAt: new Date() },
            notifSettings ?? undefined,
          );
        } catch (alertErr) {
          console.error('[SABFLOW V1 RUN] failure-alert dispatch error:', alertErr);
        }
      }

      return { ok: false as const, message, status };
    }
  };

  if (body.wait) {
    const outcome = await runAndFinalise();
    if (outcome.ok) {
      return NextResponse.json({
        executionId: created.id,
        status: outcome.result.result.isCompleted ? 'success' : 'pending_input',
        messages: outcome.result.result.messages,
        variables: outcome.result.result.updatedVariables,
      });
    }
    return NextResponse.json(
      {
        executionId: created.id,
        status: outcome.status,
        error: outcome.message,
      },
      {
        status:
          outcome.status === 'cancelled' /* concurrency-limited */
            ? 429
            : 500,
      },
    );
  }

  /* Fire-and-forget mode — kick off the run, return the row immediately.
     Errors are surfaced via the execution record (GET /executions/:id). */
  void runAndFinalise();
  return NextResponse.json({
    executionId: created.id,
    status: 'running',
  });
}
