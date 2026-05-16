/**
 * Forge block: Workflow Retriever
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/retrievers/RetrieverWorkflow
 *
 * Delegates retrieval to another SabFlow flow. Stubbed for now — wire this up
 * to `engine/executeFlow` once flow-as-tool plumbing lands.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function retrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('WorkflowRetriever: query is required');
  const flowId = asString(ctx.options.flow_id);
  if (!flowId) throw new Error('WorkflowRetriever: flow_id is required');
  return {
    outputs: { retrieved: [], note: 'use engine/executeFlow', flow_id: flowId, query },
    logs: [`WorkflowRetriever stub → flow ${flowId}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_retriever_workflow',
  name: 'Workflow Retriever',
  description: 'Use another SabFlow flow as a retriever (stub).',
  iconName: 'LuWorkflow',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'retrieve',
      label: 'Retrieve via workflow',
      description: 'Delegate retrieval to another flow by id.',
      fields: [
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'flow_id', label: 'Target flow id', type: 'text', required: true },
      ],
      run: retrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
