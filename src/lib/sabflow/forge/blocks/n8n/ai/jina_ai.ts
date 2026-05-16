/**
 * Forge block: Jina AI
 *
 * Source: n8n-master/packages/nodes-base/nodes/JinaAI/JinaAi.node.ts
 * Credential type: 'jina_ai' (expects { apiKey }).
 *
 * Operations:
 *   - reader.read       GET https://r.jina.ai/<encoded-url>     (Bearer <apiKey>)
 *   - search.search     GET https://s.jina.ai/?q=...            (Bearer <apiKey>)
 *   - embeddings.embed  POST https://api.jina.ai/v1/embeddings
 *   - rerank            POST https://api.jina.ai/v1/rerank
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString, requireCredential } from '../_shared/http';

function bearer(ctx: ForgeActionContext): string {
  const cred = requireCredential('Jina AI', ctx.credential);
  const key = cred.apiKey ?? cred.accessToken;
  if (!key) throw new Error('Jina AI: credential is missing `apiKey`');
  return `Bearer ${key}`;
}

async function readerRead(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('Jina reader: url is required');

  const res = await apiRequest({
    service: 'Jina reader',
    method: 'GET',
    url: `https://r.jina.ai/${url}`,
    headers: { Authorization: bearer(ctx), Accept: 'application/json' },
  });
  const body = res.data as { data?: { content?: string; title?: string } } | string;
  const out = typeof body === 'string'
    ? { content: body, title: '' }
    : { content: body?.data?.content ?? '', title: body?.data?.title ?? '' };
  return {
    outputs: { ...out, raw: res.data },
    logs: [`Jina reader → ${url}`],
  };
}

async function searchSearch(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  if (!query) throw new Error('Jina search: query is required');

  const res = await apiRequest({
    service: 'Jina search',
    method: 'GET',
    url: `https://s.jina.ai/?q=${encodeURIComponent(query)}`,
    headers: { Authorization: bearer(ctx), Accept: 'application/json' },
  });
  const body = res.data as { data?: unknown[] } | string;
  const results = typeof body === 'object' && body && Array.isArray(body.data) ? body.data : [];
  return {
    outputs: { results, raw: res.data },
    logs: [`Jina search → ${query} (${results.length})`],
  };
}

async function embed(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = asString(ctx.options.input);
  if (!input) throw new Error('Jina embed: input is required');
  const model = asString(ctx.options.model) || 'jina-embeddings-v2-base-en';

  const res = await apiRequest({
    service: 'Jina embed',
    method: 'POST',
    url: 'https://api.jina.ai/v1/embeddings',
    headers: { Authorization: bearer(ctx) },
    json: { model, input: [input] },
  });
  const body = res.data as { data?: Array<{ embedding?: number[] }> };
  return {
    outputs: { embedding: body?.data?.[0]?.embedding ?? [], raw: res.data },
    logs: [`Jina embed → ${model}`],
  };
}

async function rerank(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const query = asString(ctx.options.query);
  const documentsRaw = asString(ctx.options.documents);
  if (!query) throw new Error('Jina rerank: query is required');
  if (!documentsRaw) throw new Error('Jina rerank: documents are required');
  let documents: string[];
  try {
    const parsed = JSON.parse(documentsRaw);
    documents = Array.isArray(parsed) ? parsed.map((x) => String(x)) : [documentsRaw];
  } catch {
    documents = documentsRaw.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  const model = asString(ctx.options.model) || 'jina-reranker-v1-base-en';

  const res = await apiRequest({
    service: 'Jina rerank',
    method: 'POST',
    url: 'https://api.jina.ai/v1/rerank',
    headers: { Authorization: bearer(ctx) },
    json: { model, query, documents },
  });
  return {
    outputs: { results: res.data },
    logs: [`Jina rerank → ${model} (${documents.length})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_jina_ai',
  name: 'Jina AI',
  description: 'Read URLs, web search, embed and rerank with Jina AI.',
  iconName: 'LuBookOpen',
  category: 'Integration',
  auth: { type: 'apiKey', credentialType: 'jina_ai' },
  actions: [
    {
      id: 'reader_read',
      label: 'Read URL',
      description: 'Pull a clean markdown reading of any URL.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true },
      ],
      run: readerRead,
    },
    {
      id: 'search_search',
      label: 'Web search',
      description: 'Run a web search and return results.',
      fields: [
        { id: 'query', label: 'Query', type: 'text', required: true },
      ],
      run: searchSearch,
    },
    {
      id: 'embed',
      label: 'Create embedding',
      description: 'Embed text into a vector.',
      fields: [
        { id: 'input', label: 'Input', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'jina-embeddings-v2-base-en' },
      ],
      run: embed,
    },
    {
      id: 'rerank',
      label: 'Rerank documents',
      description: 'Rerank candidate docs against a query.',
      fields: [
        { id: 'query', label: 'Query', type: 'text', required: true },
        { id: 'documents', label: 'Documents (JSON array or newline-separated)', type: 'textarea', required: true },
        { id: 'model', label: 'Model', type: 'text', placeholder: 'jina-reranker-v1-base-en' },
      ],
      run: rerank,
    },
  ],
};

registerForgeBlock(block);
export default block;
