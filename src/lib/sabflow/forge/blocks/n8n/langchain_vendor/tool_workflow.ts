/**
 * Forge block: LangChain Tool — Workflow
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolWorkflow/
 *
 * Stub. The real implementation hands off to another SabFlow workflow by id
 * (with an input payload). Until the engine exposes cross-flow invocation,
 * this block just records the intent and returns `{ called: false }`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function call(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const workflowId = asString(ctx.options.workflowId).trim();
  const input = asString(ctx.options.input);
  if (!workflowId) throw new Error('Workflow Tool: workflowId is required');

  return {
    outputs: {
      called: false,
      workflowId,
      input,
      note: 'engine plumbing pending — cross-flow invocation not yet wired',
    },
    logs: [`Workflow Tool → would call ${workflowId} (deferred)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_workflow',
  name: 'LangChain Tool — Workflow',
  description: 'Invoke another SabFlow workflow as a tool (stub — engine plumbing pending).',
  iconName: 'LuWorkflow',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'call',
      label: 'Call workflow',
      fields: [
        { id: 'workflowId', label: 'Workflow ID', type: 'text', required: true },
        { id: 'input', label: 'Input', type: 'textarea', placeholder: 'string payload for the called flow' },
      ],
      run: call,
    },
  ],
};

registerForgeBlock(block);
export default block;
