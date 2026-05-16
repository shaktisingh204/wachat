/**
 * Forge block: Stable Diffusion XL
 *
 * Two flavours:
 *   - via Stability AI (`api.stability.ai/v2beta/stable-image/generate/sd3`).
 *   - via Replicate (run an SDXL model version).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

const STABILITY_API = 'https://api.stability.ai';
const REPLICATE_API = 'https://api.replicate.com/v1';

async function stabilityGenerate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const prompt = asString(ctx.options.prompt);
  const aspectRatio = asString(ctx.options.aspectRatio) || '1:1';
  const outputFormat = asString(ctx.options.outputFormat) || 'png';
  if (!apiKey) throw new Error('SDXL: apiKey is required');
  if (!prompt) throw new Error('SDXL: prompt is required');

  // multipart/form-data via FormData
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('aspect_ratio', aspectRatio);
  form.append('output_format', outputFormat);
  const negative = asString(ctx.options.negativePrompt);
  if (negative) form.append('negative_prompt', negative);

  const res = await fetch(`${STABILITY_API}/v2beta/stable-image/generate/sd3`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    const clip = text.length > 300 ? `${text.slice(0, 300)}…` : text;
    throw new Error(`SDXL POST stability sd3 failed (${res.status}): ${clip}`);
  }
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* image bytes returned as text */ }
  return { outputs: { image: data }, logs: [`SDXL (Stability) generate → ${aspectRatio}`] };
}

async function replicateSdxl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  const version = asString(ctx.options.version) || '39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b';
  const prompt = asString(ctx.options.prompt);
  const width = asNumber(ctx.options.width) ?? 1024;
  const height = asNumber(ctx.options.height) ?? 1024;
  if (!apiKey) throw new Error('SDXL: apiKey is required');
  if (!prompt) throw new Error('SDXL: prompt is required');
  const res = await apiRequest({
    service: 'SDXL',
    method: 'POST',
    url: `${REPLICATE_API}/predictions`,
    headers: { Authorization: `Token ${apiKey}` },
    json: { version, input: { prompt, width, height } },
  });
  return { outputs: { prediction: res.data }, logs: [`SDXL (Replicate) → ${version}`] };
}

const block: ForgeBlock = {
  id: 'forge_sdxl',
  name: 'Stable Diffusion XL',
  description: 'Generate images via Stability AI SD3 or Replicate-hosted SDXL.',
  iconName: 'LuImage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'stability_generate',
      label: 'Generate (Stability AI)',
      fields: [
        { id: 'apiKey', label: 'Stability API key', type: 'password', required: true },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'negativePrompt', label: 'Negative prompt', type: 'textarea' },
        { id: 'aspectRatio', label: 'Aspect ratio', type: 'select', options: [
          { label: '1:1', value: '1:1' },
          { label: '16:9', value: '16:9' },
          { label: '9:16', value: '9:16' },
          { label: '4:5', value: '4:5' },
          { label: '5:4', value: '5:4' },
          { label: '3:2', value: '3:2' },
          { label: '2:3', value: '2:3' },
          { label: '21:9', value: '21:9' },
          { label: '9:21', value: '9:21' },
        ], defaultValue: '1:1' },
        { id: 'outputFormat', label: 'Output format', type: 'select', options: [
          { label: 'PNG', value: 'png' },
          { label: 'JPEG', value: 'jpeg' },
          { label: 'WebP', value: 'webp' },
        ], defaultValue: 'png' },
      ],
      run: stabilityGenerate,
    },
    {
      id: 'replicate_generate',
      label: 'Generate (Replicate SDXL)',
      fields: [
        { id: 'apiKey', label: 'Replicate token', type: 'password', required: true },
        { id: 'version', label: 'Model version', type: 'text' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'width', label: 'Width', type: 'number', defaultValue: 1024 },
        { id: 'height', label: 'Height', type: 'number', defaultValue: 1024 },
      ],
      run: replicateSdxl,
    },
  ],
};

registerForgeBlock(block);
export default block;
