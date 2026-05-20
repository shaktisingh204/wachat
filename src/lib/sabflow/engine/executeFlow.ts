import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { SessionState, ExecutionResult, InputRequest } from './types';
import type { OutgoingMessage } from './types';
import { executeBlock } from './executeBlock';
import { buildBlockNameMap } from '@/lib/sabflow/nodeOutputs/nodeNames';
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

  // The keys of the loaded env-vars bag double as the allowlist for
  // n8n-style `{{ $env.KEY }}` expressions evaluated by the advanced
  // engine. Default-deny: a var must have been provisioned for this
  // workspace before expressions can read it.
  const envAllowlist = Object.keys(envVars);

  try {
    const result = await runFlowInner(
      flow,
      sessionWithEnv,
      userInput,
      executionId,
      callerStack,
      envAllowlist,
    );
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
  envAllowlist?: string[],
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
  // Display-name map → used both to attribute outputs to a `$node["..."]` key
  // AND to tell forge blocks what their own display name is for diagnostics.
  // Names are stable across renders provided block ids don't change.
  const blockNameMap = buildBlockNameMap(flow.groups);
  // Per-block outputs accumulator. After each block completes, its raw
  // `outputs` bag (returned by the forge action's `run()`) is stashed here
  // under `{ json: <outputs> }` so the next block's expression engine can
  // resolve `{{ $node["<DisplayName>"].json.<key> }}`.
  // Each entry stores BOTH the single-shot `json` bag (back-compat for
  // `{{ $node["X"].json.foo }}` references) AND the full per-item `items`
  // array used by Phase 7 per-item iteration. Most blocks only ever write
  // `json`; list/getAll ops populate `items` so downstream blocks can fan
  // out one run per row.
  // `pairedItems` is the parallel ancestry array — index N tells which
  // upstream item produced `items[N]`. `prevNodeName` records this block's
  // own immediate upstream so `$getPairedItem` can hop back through the
  // chain (Phase 9).
  const nodeOutputs: Record<
    string,
    {
      json: unknown;
      items?: Array<Record<string, unknown>>;
      pairedItems?: Array<{ item: number; input?: number }>;
      prevNodeName?: string;
    }
  > = {};
  // Seed from any previously-recorded outputs in the session — restored across
  // pauses (waiting on user input) so chained references keep working when
  // the flow resumes.
  if (session.nodeOutputs && typeof session.nodeOutputs === 'object') {
    for (const [k, v] of Object.entries(session.nodeOutputs as Record<string, unknown>)) {
      if (v && typeof v === 'object' && 'json' in (v as object)) {
        nodeOutputs[k] = v as { json: unknown };
      }
    }
  }

  // Run-from-here seed: when the session points at a non-start position
  // (rerun OR editor's "run from this node"), walk every block declared
  // before the start point and seed `nodeOutputs` from each one's
  // `block.pinData`. Lets the started block reference upstream values via
  // `$node["X"].json.<key>` without re-running the trigger. Skipped blocks
  // WITHOUT pinData stay absent — downstream reads to them return empty,
  // which matches n8n's behaviour for "run from here without pinning".
  const isMidFlowStart =
    session.currentGroupId !== flow.groups[0]?.id ||
    session.currentBlockIndex > 0;
  if (isMidFlowStart) {
    for (const group of flow.groups) {
      for (let bi = 0; bi < group.blocks.length; bi++) {
        const b = group.blocks[bi];
        // Stop at the start position — anything from here on runs for real.
        if (
          group.id === session.currentGroupId &&
          bi === session.currentBlockIndex
        ) {
          break;
        }
        if (b.pinData?.outputs && Object.keys(b.pinData.outputs).length > 0) {
          const name = blockNameMap.get(b.id) ?? b.id;
          nodeOutputs[name] = {
            json: b.pinData.outputs,
            items:
              b.pinData.items && b.pinData.items.length > 0
                ? b.pinData.items
                : undefined,
          };
        }
      }
      if (group.id === session.currentGroupId) break;
    }
  }

  const blockCtxBase = {
    userId: flow.userId,
    callerStack: [...(callerStack ?? []), selfFlowId],
    // Thread executionId so executeBlock can emit per-item trace events.
    executionId,
    // Threaded into the forge executor so expressions like
    // `{{ $node["Webhook"].json.email }}` resolve to the real upstream value.
    flow,
    // `$execution.id` / `$execution.mode` inside expressions. Default mode
    // is 'manual' for now — Phase 7+ will let webhook/trigger entrypoints
    // override this when they kick off a run.
    execution: executionId
      ? { id: executionId, mode: 'manual' as const }
      : undefined,
    // Default-deny allowlist for `{{ $env.KEY }}` expressions — only keys
    // actually loaded for this workspace are readable in templates.
    envAllowlist,
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

      // Resolve $prevNode by walking inbound block→block edges. When multiple
      // blocks feed into this one we take the first deterministic match —
      // matches n8n's behaviour (the expression engine has no concept of
      // which fan-in was active, and most flows have a single upstream).
      // Edges originating from an event/trigger are ignored: $prevNode is a
      // "previous block" shortcut, not "previous anything".
      const inbound = flow.edges.find(
        (e) => e.to.blockId === block.id && e.from.blockId !== undefined,
      );
      const prevSourceId = inbound?.from.blockId;
      const prevNodeName = prevSourceId
        ? blockNameMap.get(prevSourceId) ?? prevSourceId
        : undefined;

      // itemIndex is the 0-based position of the block within its group; used
      // by the trace emitter to distinguish per-row events within a block.
      // currentNodeName + nodeOutputs are threaded per block so each forge
      // run sees the latest upstream-output map.
      const blockCtx = {
        ...blockCtxBase,
        itemIndex: i,
        nodeOutputs,
        currentNodeName: blockNameMap.get(block.id) ?? block.id,
        prevNodeName,
      };

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

      // Stash this block's raw outputs under its display name so the NEXT
      // block can reference them as `{{ $node["<DisplayName>"].json.<key> }}`.
      // Mirrors n8n's per-node output stream. Skipped when the block
      // returned no outputs (UI-only bubble blocks etc.).
      if (blockResult.forgeOutputs && Object.keys(blockResult.forgeOutputs).length) {
        const displayName = blockNameMap.get(block.id) ?? block.id;
        nodeOutputs[displayName] = {
          json: blockResult.forgeOutputs,
          // Only populate `items` when the action actually produced multiple
          // items (or one item that was distinct from the legacy single-bag
          // output). A solitary single-bag entry would defeat downstream
          // back-compat — readers that don't iterate would still see the
          // same `json` value via `$node["X"].json`.
          items:
            blockResult.forgeItems && blockResult.forgeItems.length > 0
              ? blockResult.forgeItems
              : undefined,
          pairedItems:
            blockResult.forgePairedItems &&
            blockResult.forgePairedItems.length > 0
              ? blockResult.forgePairedItems
              : undefined,
          prevNodeName: blockCtx.prevNodeName,
        };
      }

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
