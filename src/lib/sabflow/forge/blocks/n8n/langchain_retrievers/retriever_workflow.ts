/**
 * Forge block: Workflow Retriever
 *
 * Source: n8n-master/packages/@n8n/nodes-langchain/nodes/retrievers/RetrieverWorkflow
 *
 * Delegates retrieval to another SabFlow flow. The target flow receives the
 * query as a seeded `query` variable (plus any user-supplied JSON metadata)
 * and is expected to return its top-k documents as either:
 *   1. A variable named `retrieved` holding a JSON array of documents, OR
 *   2. Text messages — each message becomes one `{ pageContent }` document.
 *
 * The retriever surface is intentionally narrow: the called flow owns the
 * vector store / embedding logic, so the user can swap retrieval strategies
 * (vector DB, BM25, hybrid, HyDE, …) without re-wiring this block.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';
import { executeFlow } from '@/lib/sabflow/engine';
import { getSabFlowById } from '@/lib/sabflow/db';

type RetrievedDoc = { pageContent: string; metadata?: Record<string, unknown> };

/** Coerce the flow's `retrieved` variable / messages into a normalised doc list. */
function normaliseRetrieved(
  retrievedVar: string | undefined,
  messages: Array<{ type: string; content: string }>,
): RetrievedDoc[] {
  // Preferred path: the target flow set a `retrieved` variable containing
  // JSON. Each entry can be a plain string OR `{ pageContent, metadata }`.
  if (retrievedVar) {
    try {
      const parsed: unknown = JSON.parse(retrievedVar);
      if (Array.isArray(parsed)) {
        return parsed.map((item): RetrievedDoc => {
          if (typeof item === 'string') return { pageContent: item };
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            const page =
              obj.pageContent ?? obj.content ?? obj.text ?? JSON.stringify(obj);
            const metadata =
              obj.metadata && typeof obj.metadata === 'object'
                ? (obj.metadata as Record<string, unknown>)
                : undefined;
            return { pageContent: String(page), metadata };
          }
          return { pageContent: String(item) };
        });
      }
    } catch {
      // Fall through to the messages path — the variable is not JSON.
      return [{ pageContent: retrievedVar }];
    }
  }

  // Fallback: treat each text message as one doc.
  return (messages ?? [])
    .filter((m) => m.type === 'text' && m.content)
    .map((m) => ({ pageContent: m.content }));
}

async function retrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('WorkflowRetriever: query is required');
  const flowId = asString(ctx.options.flow_id).trim();
  if (!flowId) throw new Error('WorkflowRetriever: flow_id is required');
  if (!ctx.userId) {
    throw new Error(
      'WorkflowRetriever: caller userId is missing — sub-workflow invocation requires authenticated context.',
    );
  }

  // Cycle guard — same protection as ExecuteWorkflow.
  const stack = ctx.callerStack ?? [];
  if (stack.includes(flowId)) {
    throw new Error(
      `WorkflowRetriever: cycle detected — flow "${flowId}" already in caller stack.`,
    );
  }

  const topK = Number(ctx.options.top_k ?? 4) | 0 || 4;
  const metaRaw = asString(ctx.options.metadata);
  let metadataSeed: Record<string, string> = {};
  if (metaRaw.trim()) {
    try {
      const parsed = JSON.parse(metaRaw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          metadataSeed[k] = v === null || v === undefined ? '' : String(v);
        }
      }
    } catch {
      throw new Error('WorkflowRetriever: metadata must be valid JSON when provided');
    }
  }

  const targetFlow = await getSabFlowById(flowId);
  if (!targetFlow) {
    throw new Error(`WorkflowRetriever: target flow "${flowId}" not found.`);
  }
  if (targetFlow.userId !== ctx.userId) {
    throw new Error(
      `WorkflowRetriever: target flow "${flowId}" belongs to a different workspace.`,
    );
  }
  const startGroupId = targetFlow.groups[0]?.id;
  if (!startGroupId) {
    throw new Error(
      `WorkflowRetriever: target flow "${flowId}" has no executable groups.`,
    );
  }

  // Seed the retrieval flow: defaults → metadata → reserved retriever keys.
  // `query` and `top_k` are always last so the caller can't accidentally
  // shadow them via the metadata payload.
  const seededVars: Record<string, string> = {};
  for (const v of targetFlow.variables ?? []) {
    if (v.defaultValue !== undefined) seededVars[v.name] = String(v.defaultValue);
    else if (v.value !== undefined) seededVars[v.name] = String(v.value);
  }
  Object.assign(seededVars, metadataSeed);
  seededVars.query = query;
  seededVars.top_k = String(topK);

  // Forward the caller stack so deeper sub-workflow invocations can detect
  // cycles all the way up.  `runFlowInner` pushes the sub-flow's id on top.
  const { result } = await executeFlow(
    targetFlow,
    {
      flowId,
      currentGroupId: startGroupId,
      currentBlockIndex: 0,
      variables: seededVars,
      history: [],
    },
    undefined,
    undefined,
    stack,
  );

  const retrieved = normaliseRetrieved(
    result.updatedVariables?.retrieved,
    result.messages ?? [],
  ).slice(0, topK);

  return {
    outputs: {
      retrieved,
      count: retrieved.length,
      flow_id: flowId,
      query,
      isCompleted: result.isCompleted,
    },
    logs: [
      `WorkflowRetriever → flow ${flowId}: ${retrieved.length} doc(s) (top_k=${topK})`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_retriever_workflow',
  name: 'Workflow Retriever',
  description: 'Use another SabFlow flow as a retriever — seeds {query, top_k} and returns its documents.',
  iconName: 'LuWorkflow',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'retrieve',
      label: 'Retrieve via workflow',
      description:
        'Run the target flow with the query as input; return its `retrieved` variable (JSON array) or text messages as documents.',
      fields: [
        { id: 'query', label: 'Query', type: 'textarea', required: true },
        { id: 'flow_id', label: 'Target flow id', type: 'text', required: true },
        {
          id: 'top_k',
          label: 'Top K',
          type: 'number',
          defaultValue: 4,
          helperText: 'Maximum number of documents to return.',
        },
        {
          id: 'metadata',
          label: 'Extra metadata (JSON)',
          type: 'textarea',
          placeholder: '{"namespace": "kb-prod"}',
          helperText: 'Optional JSON object seeded into the called flow as extra variables.',
        },
      ],
      run: retrieve,
    },
  ],
};

registerForgeBlock(block);
export default block;
