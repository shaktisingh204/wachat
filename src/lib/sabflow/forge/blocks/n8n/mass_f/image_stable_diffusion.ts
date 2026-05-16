/**
 * Forge block: Image Stable Diffusion
 *
 * Generates an image with Stability AI's `core` model
 * (`https://api.stability.ai/v2beta/stable-image/generate/core`). The API
 * returns either an `image/*` body (base64) or a JSON wrapper when
 * `Accept: application/json` is set — we always request JSON so the output is
 * a base64 string in `image`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.stability.ai/v2beta/stable-image/generate/core';

async function generate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Stable Diffusion: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Stable Diffusion: prompt is required');
  const negativePrompt = asString(ctx.options.negativePrompt);
  const aspectRatio = asString(ctx.options.aspectRatio) || '1:1';
  const outputFormat = asString(ctx.options.outputFormat) || 'png';

  // Stability's `generate/core` expects multipart/form-data.
  const form = new FormData();
  form.append('prompt', prompt);
  if (negativePrompt) form.append('negative_prompt', negativePrompt);
  form.append('aspect_ratio', aspectRatio);
  form.append('output_format', outputFormat);

  const res = await fetch(API, {
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
    throw new Error(`Stable Diffusion POST ${API} failed (${res.status}): ${clip}`);
  }
  let body: { image?: string; finish_reason?: string; seed?: number } = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Some variants return raw base64 string.
    body = { image: text };
  }

  return {
    outputs: {
      b64: body.image ?? '',
      url: '',
      finishReason: body.finish_reason ?? '',
      seed: body.seed,
      raw: body,
    },
    logs: [`Stable Diffusion generated (${outputFormat}, ${aspectRatio})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_image_stable_diffusion',
  name: 'Image Stable Diffusion',
  description: 'Generate an image with Stability AI Stable Diffusion.',
  iconName: 'LuImage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate image',
      description: 'Create a single image via stability.ai. Output `b64` contains base64-encoded image bytes.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'negativePrompt', label: 'Negative prompt', type: 'textarea' },
        { id: 'aspectRatio', label: 'Aspect ratio', type: 'text', defaultValue: '1:1', placeholder: '1:1, 16:9, 9:16, 3:2…' },
        { id: 'outputFormat', label: 'Output format', type: 'text', defaultValue: 'png', placeholder: 'png | jpeg | webp' },
      ],
      run: generate,
    },
  ],
};

registerForgeBlock(block);
export default block;
