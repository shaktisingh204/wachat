/**
 * Forge block: Execute Workflow
 *
 * Source: n8n-master/packages/nodes-base/nodes/ExecuteWorkflow/ExecuteWorkflow/ExecuteWorkflow.node.ts
 * Credential type: none.
 *
 * Runtime: STUBBED. Sub-flow execution must go through SabFlow's own engine —
 * see `src/lib/sabflow/engine/executeFlow.ts`. We do not invoke it from a
 * forge block because the engine wants caller context (org, plan, credits,
 * RBAC) that's not available in the forge action ctx. The SabFlow native
 * equivalent is the "Run sub-flow" canvas action.
 *
 * This action records the intent (workflowId + inputs) and emits a `queued`
 * payload that downstream blocks can use to trigger a server action.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function invoke(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workflowId = asString(ctx.options.workflowId);
  if (!workflowId) throw new Error('ExecuteWorkflow: workflowId is required');
  const inputsRaw = ctx.options.inputs;
  const inputs =
    inputsRaw && typeof inputsRaw === 'object' && !Array.isArray(inputsRaw)
      ? (inputsRaw as Record<string, unknown>)
      : {};
  return {
    outputs: {
      queued: true,
      workflowId,
      inputs,
      note:
        'Sub-flow execution is stubbed in forge blocks — invoke ' +
        '`src/lib/sabflow/engine/executeFlow.ts` from a server action.',
    },
    logs: [`ExecuteWorkflow invoke → ${workflowId} (stub, not executed)`],
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
      ],
      run: invoke,
    },
  ],
};

registerForgeBlock(block);
export default block;
