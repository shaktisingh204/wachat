/**
 * Forge block: Execute Workflow.
 *
 * Source-inspired by n8n's ExecuteWorkflow node; SabFlow's implementation
 * runs the target flow through `executeFlow` synchronously and returns the
 * sub-flow's final variables + last messages as outputs.
 *
 * Safety:
 *   - Authorisation: the target flow must be owned by the same userId as
 *     the caller (ctx.userId).  Cross-tenant calls are rejected.
 *   - Cycle detection: ctx.callerStack must not already contain the target
 *     flow id — protects against accidental recursion.
 *   - Concurrency: inherits the target flow's own `maxConcurrentRuns`
 *     setting via the existing acquireRunSlot gate inside executeFlow.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';
import { executeFlow } from '@/lib/sabflow/engine';
import { getSabFlowById } from '@/lib/sabflow/db';
import {
  cacheGet,
  cacheSet,
  makeCacheKey,
} from './subWorkflowCache';

async function invoke(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workflowId = asString(ctx.options.workflowId);
  if (!workflowId) throw new Error('ExecuteWorkflow: workflowId is required');
  if (!ctx.userId) {
    throw new Error(
      'ExecuteWorkflow: caller userId is missing — sub-workflow invocation requires authenticated context.',
    );
  }

  // Cycle guard: cannot call a flow that's already on the stack.
  const stack = ctx.callerStack ?? [];
  if (stack.includes(workflowId)) {
    throw new Error(
      `ExecuteWorkflow: cycle detected — flow "${workflowId}" already in caller stack [${stack.join(' → ')}].`,
    );
  }

  const inputsRaw = ctx.options.inputs;
  const inputs =
    inputsRaw && typeof inputsRaw === 'object' && !Array.isArray(inputsRaw)
      ? (inputsRaw as Record<string, unknown>)
      : {};

  // Optional result cache.  Opt-in via `cacheTtlSeconds` on block options.
  const ttlSeconds = Number(ctx.options.cacheTtlSeconds ?? 0) | 0;
  const cacheKey =
    ttlSeconds > 0 ? makeCacheKey(workflowId, ctx.userId, inputs) : null;
  if (cacheKey) {
    const hit = cacheGet(cacheKey);
    if (hit) {
      return {
        outputs: { ...hit, cached: true },
        logs: [`ExecuteWorkflow → ${workflowId}: cache hit (ttl=${ttlSeconds}s)`],
      };
    }
  }

  const targetFlow = await getSabFlowById(workflowId);
  if (!targetFlow) {
    throw new Error(`ExecuteWorkflow: target flow "${workflowId}" not found.`);
  }
  if (targetFlow.userId !== ctx.userId) {
    throw new Error(
      `ExecuteWorkflow: target flow "${workflowId}" belongs to a different workspace.`,
    );
  }

  const startGroupId = targetFlow.groups[0]?.id;
  if (!startGroupId) {
    throw new Error(
      `ExecuteWorkflow: target flow "${workflowId}" has no executable groups.`,
    );
  }

  const seededVars: Record<string, string> = {};
  for (const v of targetFlow.variables ?? []) {
    if (v.defaultValue !== undefined) seededVars[v.name] = String(v.defaultValue);
    else if (v.value !== undefined) seededVars[v.name] = String(v.value);
  }
  for (const [k, v] of Object.entries(inputs)) {
    seededVars[k] = v === null || v === undefined ? '' : String(v);
  }

  // Forward the caller stack so the sub-flow sees the calling chain and any
  // deeper `forge_execute_workflow` invocations can detect cycles all the way
  // up.  `runFlowInner` will push the sub-flow's own id on top of this.
  const result = await executeFlow(
    targetFlow,
    {
      flowId: workflowId,
      currentGroupId: startGroupId,
      currentBlockIndex: 0,
      variables: seededVars,
      history: [],
    },
    undefined,
    undefined,
    stack,
  );

  const outputs = {
    ok: true,
    workflowId,
    isCompleted: result.result.isCompleted,
    variables: result.result.updatedVariables,
    messages: result.result.messages,
  };

  // Only cache fully-completed runs — caching a paused/input-waiting run
  // would short-circuit subsequent invocations that need to provide input.
  if (cacheKey && result.result.isCompleted) {
    cacheSet(cacheKey, outputs as Record<string, unknown>, ttlSeconds * 1000);
  }

  return {
    outputs,
    logs: [
      `ExecuteWorkflow → ${workflowId}: ${result.updatedSession.history.length} step(s), ${
        result.result.isCompleted ? 'completed' : 'paused'
      }${cacheKey ? `, cached for ${ttlSeconds}s` : ''}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_execute_workflow',
  name: 'Execute Workflow',
  description: 'Stubbed — record a sub-flow invocation request (no actual run).',
  iconName: 'LuWorkflow',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'invoke',
      label: 'Invoke sub-flow',
      description: 'Record a sub-flow id + inputs. Actual run requires server action.',
      fields: [
        {
          id: 'workflowId',
          label: 'Workflow ID',
          type: 'text',
          required: true,
          placeholder: 'flw_abc123',
        },
        {
          id: 'inputs',
          label: 'Inputs',
          type: 'json',
          placeholder: '{"foo": "bar"}',
          helperText: 'JSON object passed as the sub-flow input variables.',
        },
        {
          id: 'cacheTtlSeconds',
          label: 'Cache TTL (seconds)',
          type: 'number',
          placeholder: '0',
          helperText:
            'Cache the sub-flow result for this many seconds.  0 disables caching.  Same (workflowId + inputs) → same result.',
        },
      ],
      run: invoke,
    },
  ],
};

registerForgeBlock(block);
export default block;
