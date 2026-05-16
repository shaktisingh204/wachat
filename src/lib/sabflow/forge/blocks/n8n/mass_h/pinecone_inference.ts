/**
 * Forge block: Pinecone Inference
 *
 * Embeddings + reranking via `https://api.pinecone.io/embed` and `/rerank`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.pinecone.io';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Pinecone Inference: apiKey is required');
  return {
    'Api-Key': apiKey,
    'X-Pinecone-API-Version': '2024-07',
  };
}

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'multilingual-e5-large';
  const inputType = asString(ctx.options.inputType) || 'passage';
  const inputsRaw = asString(ctx.options.inputs);
  if (!inputsRaw) throw new Error('Pinecone Inference: inputs is required');
  const inputs = inputsRaw.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text }));
  const res = await apiRequest({
    service: 'Pinecone Inference',
    method: 'POST',
    url: `${API}/embed`,
    headers: authHeaders(ctx),
    json: {
      model,
      inputs,
      parameters: { input_type: inputType, truncate: 'END' },
    },
  });
  return { outputs: { embeddings: res.data }, logs: [`Pinecone embed → ${model} (${inputs.length} inputs)`] };
}

async function rerank(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const model = asString(ctx.options.model) || 'bge-reranker-v2-m3';
  const query = asString(ctx.options.query);
  const documentsRaw = asString(ctx.options.documents);
  if (!query) throw new Error('Pinecone Inference: query is required');
  if (!documentsRaw) throw new Error('Pinecone Inference: documents is required');
  const documents = documentsRaw.split('\n').map((s) => s.trim()).filter(Boolean).map((text) => ({ text }));
  const res = await apiRequest({
    service: 'Pinecone Inference',
    method: 'POST',
    url: `${API}/rerank`,
    headers: authHeaders(ctx),
    json: { model, query, documents, return_documents: true },
  });
  return { outputs: { rerank: res.data }, logs: [`Pinecone rerank → ${model} (${documents.length} docs)`] };
}

const block: ForgeBlock = {
  id: 'forge_pinecone_inference',
  name: 'Pinecone Inference',
  description: 'Generate embeddings and rerank documents via the Pinecone Inference API.',
  iconName: 'LuDatabase',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'embed',
      label: 'Embed text',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'multilingual-e5-large' },
        { id: 'inputType', label: 'Input type', type: 'select', options: [
          { label: 'Passage', value: 'passage' },
          { label: 'Query', value: 'query' },
        ], defaultValue: 'passage' },
        { id: 'inputs', label: 'Inputs (one per line)', type: 'textarea', required: true },
      ],
      run: embed,
    },
    {
      id: 'rerank',
      label: 'Rerank documents',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'bge-reranker-v2-m3' },
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'documents', label: 'Documents (one per line)', type: 'textarea', required: true },
      ],
      run: rerank,
    },
  ],
};

registerForgeBlock(block);
export default block;
