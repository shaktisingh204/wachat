import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { SessionState, ExecutionResult, InputRequest } from './types';
import type { OutgoingMessage } from './types';
import { executeBlock } from './executeBlock';
import { acquireRunSlot } from '@/lib/sabflow/execution/concurrency';
import { loadEnvVars } from '@/lib/sabflow/envVars/db';
import { publishTraceEvent } from '@/lib/sabflow/execution/traceBus';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

type ExecuteFlowReturn = {
  result: ExecutionResult;
  updatedSession: SessionState;
};

/**
 * Execute the flow starting from the position encoded in `session`.
 *
 * The engine walks blocks sequentially within the current group, following
 * edges to new groups until either:
 *  - An input block is encountered (paused, awaiting user reply)
 *  - The flow has no more blocks/edges to follow (completed)
 *
 * When `userInput` is provided it is consumed by the first input block that is
 * encountered (i.e. the block recorded in `session.currentBlockIndex`).
 */
/**
 * Error class thrown when a run is rejected by the concurrency gate
 * (flow has `settings.onConcurrencyExceeded === 'reject'` and is at its
 * cap, or the queue is also full).  Callers can catch this specifically
 * to surface a 429 / "try again later" without confusing it with a real
 * engine error.
 */
export class ConcurrencyLimitError extends Error {
  readonly code = 'concurrency_limit_exceeded';
  readonly limit: number;
  readonly waitingCount: number;
  constructor(limit: number, waitingCount: number) {
    super(`Concurrency limit reached (cap=${limit}, queued=${waitingCount})`);
    this.name = 'ConcurrencyLimitError';
    this.limit = limit;
    this.waitingCount = waitingCount;
  }
}

export async function executeFlow(
  flow: SabFlowDoc,
  session: SessionState,
  userInput?: string,
  /**
   * When supplied, every step trace gets published to the in-process bus
   * (`execution/traceBus.ts`) keyed by this id — drives the SSE live-replay
   * endpoint.  Callers that don't care about live streaming can omit it.
   */
  executionId?: string,
  /**
   * Flow ids currently on the execution stack (oldest first).  Threaded into
   * `executeBlock` → `executeForgeBlock` → `action.run({ callerStack })` so
   * sub-workflow blocks (`forge_execute_workflow`) can detect cycles.  Empty
   * or undefined on top-level runs.
   */
  callerStack?: string[],
): Promise<ExecuteFlowReturn> {
  // Concurrency gate — opt-in via flow settings.  When disabled the gate is
  // a no-op and adds a single Map lookup of overhead per run.
  const flowKey = (flow._id?.toString?.() ?? flow.publicId ?? flow.name) as string;
  const slot = await acquireRunSlot(flowKey, flow.settings);
  if (!slot.ok) {
    throw new ConcurrencyLimitError(flow.settings?.maxConcurrentRuns ?? 0, slot.waitingCount);
  }

  const flowIdForAudit = (flow._id?.toString?.() ?? flow.publicId ?? flowKey) as string;
  if (flow.userId) {
    void recordFlowAction('flow.execution.started', {
      userId: flow.userId,
      flowId: flowIdForAudit,
      target: flowIdForAudit,
      metadata: { executionId, flowName: flow.name },
    });
  }

  // Load the workspace-scoped env vars once per run and merge them into
  // `variables` so that any block reading `{{KEY}}` resolves them.  We
  // overlay them with a `$env.` prefix too for explicit access — the
  // overlay never overwrites a flow-defined variable of the same name.
  let envVars: Record<string, string> = {};
  if (flow.userId) {
    try {
      envVars = await loadEnvVars(flow.userId);
    } catch {
      /* best-effort — engine should still run without env vars */
    }
  }
  const sessionWithEnv: SessionState = {
    ...session,
    variables: {
      ...Object.fromEntries(
        Object.entries(envVars).map(([k, v]) => [`$env.${k}`, v]),
      ),
      ...session.variables,
    },
  };

  try {
    const result = await runFlowInner(flow, sessionWithEnv, userInput, executionId, callerStack);
    if (executionId) {
      publishTraceEvent({
        kind: 'end',
        executionId,
        status: result.result.isCompleted ? 'success' : 'success', // paused waiting input is not a failure
      });
    }
    if (flow.userId && result.result.isCompleted) {
      void recordFlowAction('flow.execution.completed', {
        userId: flow.userId,
        flowId: flowIdForAudit,
        target: flowIdForAudit,
        metadata: { executionId, flowName: flow.name },
      });
    }
    return result;
  } catch (err) {
    if (executionId) {
      publishTraceEvent({
        kind: 'end',
        executionId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    if (flow.userId && !(err instanceof ConcurrencyLimitError)) {
      void recordFlowAction('flow.execution.failed', {
        userId: flow.userId,
        flowId: flowIdForAudit,
        target: flowIdForAudit,
        metadata: {
          executionId,
          flowName: flow.name,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
    throw err;
  } finally {
    slot.release();
  }
}

async function runFlowInner(
  flow: SabFlowDoc,
  session: SessionState,
  userInput?: string,
  executionId?: string,
  callerStack?: string[],
): Promise<ExecuteFlowReturn> {
  const messages: OutgoingMessage[] = [];
  let variables = { ...session.variables };
  let currentGroupId = session.currentGroupId;
  let currentBlockIndex = session.currentBlockIndex;
  const flowIdForAudit = (flow._id?.toString?.() ?? flow.publicId ?? flow.name) as string;

  // Safety valve: cap the number of group transitions to prevent infinite
  // loops caused by misconfigured flows.
  const MAX_GROUP_HOPS = 100;
  let hopCount = 0;

  /**
   * Step-22 trace accumulator.  Pushed to `session.history` at each block
   * boundary with input/output/duration/status so the replay view
   * (`/dashboard/sabflow/executions/[id]`) can render real n8n-style
   * per-node detail.  Errors are caught locally so a single block failure
   * gets recorded as a trace entry instead of aborting the whole run.
   */
  const traceHistory: typeof session.history = [...session.history];

  // Forge action context — workspace identity + caller stack with the
  // current flow id appended.  Sub-workflow blocks consume `callerStack`
  // for cycle detection (`forge_execute_workflow`), and SabFile/binary
  // blocks consume `userId` to mint Rust-BFF JWTs from the worker (which
  // has no Next.js cookie context).
  const selfFlowId = (flow._id?.toString?.() ?? flow.publicId ?? flow.name) as string;
  // blockCtx is rebuilt per-block inside the loop to carry the current
  // block-level itemIndex. We define the stable parts here and spread them in.
  const blockCtxBase = {
    userId: flow.userId,
    callerStack: [...(callerStack ?? []), selfFlowId],
    // Thread executionId so executeBlock can emit per-item trace events.
    executionId,
  };

  outer: while (hopCount < MAX_GROUP_HOPS) {
    const group = flow.groups.find((g) => g.id === currentGroupId);
    if (!group) break;

    for (let i = currentBlockIndex; i < group.blocks.length; i++) {
      const block = group.blocks[i];

      // Only pass userInput to the first block of the current position (the
      // one that previously requested input).
      const inputForThisBlock =
        i === session.currentBlockIndex &&
        currentGroupId === session.currentGroupId
          ? userInput
          : undefined;

      // itemIndex is the 0-based position of the block within its group; used
      // by the trace emitter to distinguish per-row events within a block.
      const blockCtx = { ...blockCtxBase, itemIndex: i };

      const stepStartedAt = Date.now();
      let blockResult;
      try {
        blockResult = await executeBlock(
          block,
          variables,
          flow.edges,
          inputForThisBlock,
          blockCtx,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const durationMs = Date.now() - stepStartedAt;
        const errStep = {
          groupId: currentGroupId,
          blockId: block.id,
          blockType: block.type,
          input: inputForThisBlock,
          timestamp: new Date(),
          startedAt: new Date(stepStartedAt),
          durationMs,
          status: 'error' as const,
          error: message,
        };
        traceHistory.push(errStep);
        if (executionId) {
          publishTraceEvent({
            kind: 'step',
            executionId,
            step: errStep,
            index: traceHistory.length - 1,
          });
        }
        if (flow.userId) {
          void recordFlowAction('flow.step.failed', {
            userId: flow.userId,
            flowId: flowIdForAudit,
            target: block.id,
            metadata: {
              executionId,
              blockId: block.id,
              blockType: block.type,
              groupId: currentGroupId,
              error: message,
            },
          });
        }
        // Re-throw so upstream finalisation paths (v1/run, rerun) can mark
        // the execution as `status: 'error'` and fire failure alerts.
        throw err;
      }
      const stepDurationMs = Date.now() - stepStartedAt;
      const okStep = {
        groupId: currentGroupId,
        blockId: block.id,
        blockType: block.type,
        input: inputForThisBlock,
        output: blockResult.messages.length
          ? blockResult.messages.map((m) => m.content).join('\n')
          : undefined,
        timestamp: new Date(),
        startedAt: new Date(stepStartedAt),
        durationMs: stepDurationMs,
        status: (blockResult.requiresInput ? 'waiting' : 'success') as 'waiting' | 'success',
      };
      traceHistory.push(okStep);
      if (executionId) {
        publishTraceEvent({
          kind: 'step',
          executionId,
          step: okStep,
          index: traceHistory.length - 1,
        });
      }
      if (flow.userId && okStep.status === 'success') {
        void recordFlowAction('flow.step.completed', {
          userId: flow.userId,
          flowId: flowIdForAudit,
          target: block.id,
          metadata: {
            executionId,
            blockId: block.id,
            blockType: block.type,
            groupId: currentGroupId,
            durationMs: stepDurationMs,
          },
        });
      }

      // Accumulate messages from this block
      messages.push(...blockResult.messages);

      // Merge variable updates
      if (blockResult.updatedVariables) {
        variables = blockResult.updatedVariables;
      }

      // The block needs user input — pause execution here
      if (blockResult.requiresInput) {
        const inputRequest: InputRequest = {
          type: block.type,
          blockId: block.id,
          groupId: currentGroupId,
          options: block.options as Record<string, unknown> | undefined,
        };

        return {
          result: {
            messages,
            nextInputRequest: inputRequest,
            isCompleted: false,
            updatedVariables: variables,
          },
          updatedSession: {
            ...session,
            currentGroupId,
            currentBlockIndex: i,
            variables,
            // Step-22 trace already includes the current block — no extra push.
            history: traceHistory,
          },
        };
      }

      // The block explicitly navigated to a new group (condition, jump, etc.)
      if (blockResult.nextGroupId) {
        currentGroupId = blockResult.nextGroupId;
        currentBlockIndex = 0;
        hopCount++;
        continue outer;
      }

      // The block failed and signalled how to proceed.
      if (blockResult.errorSignal) {
        if (blockResult.errorSignal.kind === 'goto') {
          currentGroupId = blockResult.errorSignal.groupId;
          currentBlockIndex = 0;
          hopCount++;
          continue outer;
        }
        // 'halt' — terminate execution with the error surfaced as a message.
        // The just-recorded trace entry's status was 'success'; rewrite it
        // to 'error' so the replay timeline shows the failure correctly.
        const lastIdx = traceHistory.length - 1;
        if (lastIdx >= 0 && traceHistory[lastIdx].blockId === block.id) {
          traceHistory[lastIdx] = {
            ...traceHistory[lastIdx],
            status: 'error',
            error: blockResult.errorSignal.message,
            output: blockResult.errorSignal.message,
          };
        }
        return {
          result: {
            messages,
            isCompleted: true,
            updatedVariables: variables,
          },
          updatedSession: {
            ...session,
            currentGroupId,
            currentBlockIndex: i,
            variables,
            history: traceHistory,
          },
        };
      }

      // The block has an outgoing edge — follow it at the end of this block
      // (handled after the for-loop falls through to the edge resolution below)
    }

    // All blocks in the current group executed.  Resolve the outgoing edge of
    // the last block (if any) to determine the next group.
    const lastBlock = group.blocks.at(-1);
    if (lastBlock?.outgoingEdgeId) {
      const edge = flow.edges.find((e) => e.id === lastBlock.outgoingEdgeId);
      if (edge?.to.groupId) {
        currentGroupId = edge.to.groupId;
        currentBlockIndex = 0;
        hopCount++;
        continue;
      }
    }

    // No outgoing edge from the last block → flow is complete
    break;
  }

  return {
    result: {
      messages,
      isCompleted: true,
      updatedVariables: variables,
    },
    updatedSession: {
      ...session,
      currentGroupId,
      currentBlockIndex: 0,
      variables,
      // Append the terminal sentinel onto the per-step trace so the
      // ExecutionHistoryEntry.nodes array ends with a clear "__end__" marker.
      history: [
        ...traceHistory,
        {
          groupId: currentGroupId,
          blockId: '__end__',
          blockType: '__end__',
          timestamp: new Date(),
        },
      ],
    },
  };
}
