/**
 * SabFlow — re-run from a specific node.
 *
 *   POST /api/sabflow/executions/[executionId]/rerun
 *   Body: { fromBlockId: string }
 *   → { execution: ExecutionHistoryEntry }
 *
 * Loads the prior execution, finds the requested block within its flow,
 * seeds a fresh SessionState (variables from the prior run + the target
 * block's group as starting point), then drives executeFlow.  Each upstream
 * node's recorded output is pinned on the new session so `$node["X"]` and
 * picker tokens resolve to the same values as the original run.
 *
 * Authorisation: caller must own the flow.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  getExecutionById,
  getSabFlowById,
  createExecutionHistory,
  updateExecutionHistory,
} from '@/lib/sabflow/db';
import { executeFlow } from '@/lib/sabflow/engine';
import type { SessionState } from '@/lib/sabflow/engine/types';
import type { Block } from '@/lib/sabflow/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ executionId: string }> },
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const userId = (session.user as { _id: { toString(): string } })._id.toString();

  const { executionId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { fromBlockId?: string };
  const fromBlockId = body.fromBlockId;
  if (!fromBlockId) {
    return NextResponse.json({ error: 'Missing fromBlockId' }, { status: 400 });
  }

  const prior = await getExecutionById(executionId);
  if (!prior) {
    return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
  }

  const flow = await getSabFlowById(prior.flowId);
  if (!flow) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }
  if (flow.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  /* Locate the target block inside the flow. */
  let targetBlock: Block | null = null;
  let targetGroupId: string | null = null;
  let targetIndex = -1;
  outer: for (const group of flow.groups) {
    for (let i = 0; i < group.blocks.length; i++) {
      if (group.blocks[i].id === fromBlockId) {
        targetBlock = group.blocks[i];
        targetGroupId = group.id;
        targetIndex = i;
        break outer;
      }
    }
  }
  if (!targetBlock || !targetGroupId) {
    return NextResponse.json(
      { error: 'Target block no longer exists in the flow' },
      { status: 400 },
    );
  }

  /*
   * Pin every upstream node's output by writing it to block.pinData on a
   * cloned flow.  executeFlow's nodeOutputs builder picks pinData up.  This
   * is a per-call clone — the persisted flow doc is not mutated.
   *
   * `prior.nodes[].output` is a stringified summary (per ExecutionStep);
   * we wrap it as a single-field outputs bag so it matches the strict
   * pinData shape introduced in Phase 10. Downstream blocks can still see
   * the value via `$node["X"].json.value`. A later phase that records the
   * full structured outputs in ExecutionStep can swap in the real shape.
   */
  const upstreamOutputs = new Map<string, unknown>();
  for (const n of prior.nodes ?? []) {
    if (n.blockId === fromBlockId) break; // stop at the target
    if (n.output !== undefined) upstreamOutputs.set(n.blockId, n.output);
  }

  const pinnedFlow = {
    ...flow,
    groups: flow.groups.map((g) => ({
      ...g,
      blocks: g.blocks.map((b) =>
        upstreamOutputs.has(b.id)
          ? {
              ...b,
              pinData: { outputs: { value: upstreamOutputs.get(b.id) } },
            }
          : b,
      ),
    })),
  };

  /* Seed a fresh session — variables carried over, position set to the
     target block. */
  const sessionState: SessionState = {
    flowId: prior.flowId,
    currentGroupId: targetGroupId,
    currentBlockIndex: targetIndex,
    variables: Object.fromEntries(
      Object.entries(prior.variables ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    ),
    history: [],
  };

  /* Record the new execution row, run, finalise. */
  const created = await createExecutionHistory({
    flowId: prior.flowId,
    sessionId: `rerun:${executionId}`,
    triggerMode: 'manual',
    startedAt: new Date(),
    status: 'running',
    nodeCount: 0,
    startNodeId: fromBlockId,
  });

  const startedAt = Date.now();
  console.log(
    `[SABFLOW RERUN] flow=${prior.flowId} from=${fromBlockId} prior=${executionId} new=${created.id}`,
  );

  try {
    const result = await executeFlow(pinnedFlow, sessionState);
    const durationMs = Date.now() - startedAt;
    await updateExecutionHistory(created.id, {
      finishedAt: new Date(),
      status: result.result.isCompleted ? 'success' : 'running',
      nodeCount: result.updatedSession.history.length,
      executionTimeMs: durationMs,
      variables: result.result.updatedVariables as Record<string, unknown>,
      // Step-22 per-block trace.
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
    console.log(
      `[SABFLOW RERUN] ok new=${created.id} duration=${durationMs}ms nodes=${result.updatedSession.history.length}`,
    );
    return NextResponse.json({ execution: { ...created, status: 'success' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[SABFLOW RERUN] error new=${created.id} flow=${prior.flowId}:`,
      err,
    );
    await updateExecutionHistory(created.id, {
      finishedAt: new Date(),
      status: 'error',
      error: message,
    });
    return NextResponse.json(
      { error: message, executionId: created.id },
      { status: 500 },
    );
  }
}

/** Silences unused-import warnings when the file is examined in isolation. */
void ObjectId;
