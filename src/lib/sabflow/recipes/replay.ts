/**
 * SabFlow — replay an existing execution.
 *
 * Given an `executionId`, replays the recorded checkpoint history through
 * the engine.  Useful for debugging ("what happened in this run?") and for
 * the canvas timeline UI.
 *
 * Replay is read-only: it does **not** persist new checkpoints — the
 * caller receives every step as a result entry instead.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { executeFlow } from '@/lib/sabflow/engine';
import { getSabFlowById } from '@/lib/sabflow/db';
import { getCheckpoint, type DurableCheckpoint } from './durable';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { ExecutionResult, SessionState } from '@/lib/sabflow/engine/types';

/** A single step in a replayed execution. */
export type ReplayStep = {
  /** Index in the replay sequence (0-based). */
  index: number;
  /** The session state *before* this step ran. */
  sessionBefore: SessionState;
  /** The session state *after* this step ran. */
  sessionAfter: SessionState;
  /** Engine output for the step. */
  result: ExecutionResult;
  /** Captured timestamp. */
  at: Date;
  /** Error message when the step itself errored during replay. */
  error?: string;
};

export type ReplayResult = {
  executionId: string;
  flow: SabFlowDoc;
  checkpoint: DurableCheckpoint;
  steps: ReplayStep[];
  completed: boolean;
};

/* ── Helpers ────────────────────────────────────────────── */

/**
 * Look up a checkpoint by either its primary `executionId` (the durable
 * id) or its Mongo `_id` (defensive — older callers may pass either).
 */
async function loadCheckpoint(
  executionId: string,
): Promise<DurableCheckpoint | null> {
  const direct = await getCheckpoint(executionId);
  if (direct) return direct;

  if (!ObjectId.isValid(executionId)) return null;
  const { db } = await connectToDatabase();
  return db
    .collection<DurableCheckpoint>('sabflow_checkpoints')
    .findOne({ _id: new ObjectId(executionId) });
}

/* ── Public API ─────────────────────────────────────────── */

/**
 * Replays a prior run from its persisted checkpoint.
 *
 * The checkpoint stores the **final** session state of the run.  To
 * reconstruct a meaningful step-by-step history we walk the engine
 * forward from the original starting position (block 0 of the trigger's
 * target group) using the saved variables, capturing one
 * `ReplayStep` per pause/completion.
 *
 * Replay terminates when the engine reports `isCompleted: true` or when
 * we hit the safety cap (`MAX_STEPS`) — whichever comes first.
 */
export async function replayExecution(
  executionId: string,
): Promise<ReplayResult | null> {
  const checkpoint = await loadCheckpoint(executionId);
  if (!checkpoint) return null;

  const flow = await getSabFlowById(checkpoint.flowId);
  if (!flow) return null;

  const steps: ReplayStep[] = [];
  const MAX_STEPS = 200;

  // Replay from the very beginning, seeded with the variables that were
  // present at start.  We can't reconstruct intermediate user inputs, so
  // the replay halts at the first input-block pause.
  let session: SessionState = {
    flowId: checkpoint.flowId,
    currentGroupId: flow.groups[0]?.id ?? '',
    currentBlockIndex: 0,
    variables: { ...checkpoint.session.variables },
    history: [],
  };

  let completed = false;

  for (let i = 0; i < MAX_STEPS; i++) {
    const sessionBefore = session;

    let result: ExecutionResult;
    let sessionAfter: SessionState;
    let error: string | undefined;

    try {
      const out = await executeFlow(flow, session);
      result = out.result;
      sessionAfter = out.updatedSession;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      result = {
        messages: [],
        isCompleted: true,
        updatedVariables: session.variables,
      };
      sessionAfter = session;
    }

    steps.push({
      index: i,
      sessionBefore,
      sessionAfter,
      result,
      at: new Date(),
      error,
    });

    if (result.isCompleted || result.nextInputRequest || error) {
      completed = result.isCompleted;
      break;
    }

    // Advance for the next iteration (only meaningful when the engine
    // returns mid-flow without an input request — defensive).
    session = sessionAfter;
  }

  return {
    executionId: checkpoint.executionId,
    flow,
    checkpoint,
    steps,
    completed,
  };
}
