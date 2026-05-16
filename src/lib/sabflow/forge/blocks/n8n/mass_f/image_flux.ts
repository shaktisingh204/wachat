/**
 * Forge block: Image Flux
 *
 * Generates an image with Black Forest Labs' Flux family via fal.ai's hosted
 * inference (`https://fal.run/<model>`) — defaults to `fal-ai/flux/schnell`.
 * fal.ai returns `{ images: [{ url, content_type, width, height }, …] }`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asNumber, asString } from '../_shared/http';

async function generate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Flux: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Flux: prompt is required');
  const model = asString(ctx.options.model) || 'fal-ai/flux/schnell';
  const imageSize = asString(ctx.options.imageSize) || 'square_hd';
  const numInferenceSteps = asNumber(ctx.options.numInferenceSteps) ?? 4;
  const seed = asNumber(ctx.options.seed);

  const body: Record<string, unknown> = {
    prompt,
    image_size: imageSize,
    num_inference_steps: numInferenceSteps,
    num_images: 1,
  };
  if (seed !== undefined) body.seed = seed;

  const res = await apiRequest({
    service: 'Flux',
    method: 'POST',
    url: `https://fal.run/${model}`,
    headers: { Authorization: `Key ${apiKey}` },
    json: body,
  });
  const data = res.data as { images?: Array<{ url?: string; content_type?: string; width?: number; height?: number }>; seed?: number };
  const first = data?.images?.[0] ?? {};
  return {
    outputs: {
      url: first.url ?? '',
      b64: '',
      contentType: first.content_type ?? '',
      width: first.width,
      height: first.height,
      seed: data?.seed,
      raw: res.data,
    },
    logs: [`Flux ${model} → ${first.url ? 'url' : 'no image'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_image_flux',
  name: 'Image Flux',
  description: 'Generate an image with Flux via fal.ai.',
  iconName: 'LuImage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate image',
      description: 'Create a single image with Flux. Output is a hosted `url` from fal.ai.',
      fields: [
        { id: 'apiKey', label: 'fal.ai API key', type: 'password', required: true },
        { id: 'model', label: 'Model', type: 'text', defaultValue: 'fal-ai/flux/schnell', placeholder: 'fal-ai/flux/schnell | fal-ai/flux/dev | fal-ai/flux-pro' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'imageSize', label: 'Image size', type: 'text', defaultValue: 'square_hd', placeholder: 'square_hd, portrait_4_3, landscape_16_9…' },
        { id: 'numInferenceSteps', label: 'Inference steps', type: 'number', defaultValue: 4 },
        { id: 'seed', label: 'Seed', type: 'number' },
      ],
      run: generate,
    },
  ],
};

registerForgeBlock(block);
export default block;
