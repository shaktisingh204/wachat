/**
 * Forge block: Replicate (general)
 *
 * Create / fetch / cancel predictions at `api.replicate.com/v1`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.replicate.com/v1';

function authHeaders(ctx: ForgeActionContext): Record<string, string> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Replicate: apiKey is required');
  return { Authorization: `Token ${apiKey}` };
}

function parseJson(input: unknown, label: string): unknown {
  const s = asString(input).trim();
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(`Replicate: ${label} must be valid JSON`);
  }
}

async function createPrediction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const version = asString(ctx.options.version);
  const inputJson = parseJson(ctx.options.input, 'input');
  if (!version) throw new Error('Replicate: version is required');
  if (!inputJson) throw new Error('Replicate: input is required');
  const res = await apiRequest({
    service: 'Replicate',
    method: 'POST',
    url: `${API}/predictions`,
    headers: authHeaders(ctx),
    json: { version, input: inputJson },
  });
  return { outputs: { prediction: res.data }, logs: [`Replicate create prediction → ${version}`] };
}

async function getPrediction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.predictionId);
  if (!id) throw new Error('Replicate: predictionId is required');
  const res = await apiRequest({
    service: 'Replicate',
    method: 'GET',
    url: `${API}/predictions/${encodeURIComponent(id)}`,
    headers: authHeaders(ctx),
  });
  return { outputs: { prediction: res.data }, logs: [`Replicate get prediction → ${id}`] };
}

async function cancelPrediction(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.predictionId);
  if (!id) throw new Error('Replicate: predictionId is required');
  const res = await apiRequest({
    service: 'Replicate',
    method: 'POST',
    url: `${API}/predictions/${encodeURIComponent(id)}/cancel`,
    headers: authHeaders(ctx),
  });
  return { outputs: { prediction: res.data }, logs: [`Replicate cancel prediction → ${id}`] };
}

const block: ForgeBlock = {
  id: 'forge_replicate',
  name: 'Replicate',
  description: 'Run predictions on Replicate models.',
  iconName: 'LuBot',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'create_prediction',
      label: 'Create prediction',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'version', label: 'Model version', type: 'text', required: true },
        { id: 'input', label: 'Input (JSON)', type: 'json', required: true },
      ],
      run: createPrediction,
    },
    {
      id: 'get_prediction',
      label: 'Get prediction',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'predictionId', label: 'Prediction ID', type: 'text', required: true },
      ],
      run: getPrediction,
    },
    {
      id: 'cancel_prediction',
      label: 'Cancel prediction',
      fields: [
        { id: 'apiKey', label: 'API token', type: 'password', required: true },
        { id: 'predictionId', label: 'Prediction ID', type: 'text', required: true },
      ],
      run: cancelPrediction,
    },
  ],
};

registerForgeBlock(block);
export default block;
