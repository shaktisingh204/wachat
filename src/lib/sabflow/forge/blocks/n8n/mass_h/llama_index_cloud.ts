/**
 * Forge block: LlamaIndex Cloud
 *
 * `https://api.cloud.llamaindex.ai/api/v1` — pipelines + parsing jobs.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.cloud.llamaindex.ai/api/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('LlamaIndex Cloud: apiKey is required');
  return { Authorization: `Bearer ${apiKey}` };
}

async function listPipelines(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const res = await apiRequest({
    service: 'LlamaIndex Cloud',
    method: 'GET',
    url: `${API}/pipelines`,
    headers: authHeaders(ctx),
  });
  return { outputs: { pipelines: res.data }, logs: ['LlamaIndex Cloud list pipelines'] };
}

async function retrieve(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const pipelineId = asString(ctx.options.pipelineId);
  const query = asString(ctx.options.query);
  if (!pipelineId) throw new Error('LlamaIndex Cloud: pipelineId is required');
  if (!query) throw new Error('LlamaIndex Cloud: query is required');
  const res = await apiRequest({
    service: 'LlamaIndex Cloud',
    method: 'POST',
    url: `${API}/pipelines/${encodeURIComponent(pipelineId)}/retrieve`,
    headers: authHeaders(ctx),
    json: { query },
  });
  return { outputs: { nodes: res.data }, logs: [`LlamaIndex Cloud retrieve → ${pipelineId}`] };
}

async function getJob(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const jobId = asString(ctx.options.jobId);
  if (!jobId) throw new Error('LlamaIndex Cloud: jobId is required');
  const res = await apiRequest({
    service: 'LlamaIndex Cloud',
    method: 'GET',
    url: `${API}/parsing/job/${encodeURIComponent(jobId)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { job: res.data }, logs: [`LlamaIndex Cloud get job → ${jobId}`] };
}

const block: ForgeBlock = {
  id: 'forge_llama_index_cloud',
  name: 'LlamaIndex Cloud',
  description: 'Query LlamaIndex Cloud pipelines and inspect parsing jobs.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'list_pipelines',
      label: 'List pipelines',
      fields: [{ id: 'apiKey', label: 'API key', type: 'password', required: true }],
      run: listPipelines,
    },
    {
      id: 'retrieve',
      label: 'Retrieve nodes',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'pipelineId', label: 'Pipeline ID', type: 'text', required: true },
        { id: 'query', label: 'Query', type: 'textarea', required: true },
      ],
      run: retrieve,
    },
    {
      id: 'get_job',
      label: 'Get parsing job',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'jobId', label: 'Job ID', type: 'text', required: true },
      ],
      run: getJob,
    },
  ],
};

registerForgeBlock(block);
export default block;
