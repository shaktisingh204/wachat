/**
 * Forge block: Image DALL-E 3
 *
 * Generates an image with OpenAI's DALL-E 3 model
 * (`https://api.openai.com/v1/images/generations`). Returns the hosted URL
 * (default) or a base64 string when `response_format=b64_json`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

const API = 'https://api.openai.com/v1/images/generations';

async function generate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('DALL-E 3: apiKey is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('DALL-E 3: prompt is required');
  const size = asString(ctx.options.size) || '1024x1024';
  const quality = asString(ctx.options.quality) || 'standard';
  const style = asString(ctx.options.style) || 'vivid';
  const responseFormat = asString(ctx.options.responseFormat) || 'url';

  const res = await apiRequest({
    service: 'DALL-E 3',
    method: 'POST',
    url: API,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: {
      model: 'dall-e-3',
      prompt,
      size,
      quality,
      style,
      response_format: responseFormat,
      n: 1,
    },
  });
  const body = res.data as { data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }> };
  const item = body?.data?.[0] ?? {};
  return {
    outputs: {
      url: item.url ?? '',
      b64: item.b64_json ?? '',
      revisedPrompt: item.revised_prompt ?? '',
      raw: res.data,
    },
    logs: [`DALL-E 3 generated → ${responseFormat}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_image_dalle3',
  name: 'Image DALL-E 3',
  description: 'Generate an image with OpenAI DALL-E 3.',
  iconName: 'LuImage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'generate',
      label: 'Generate image',
      description: 'Create a single image. Output: `url` OR `b64` (base64 PNG) depending on response format.',
      fields: [
        { id: 'apiKey', label: 'API key', type: 'password', required: true },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
        { id: 'size', label: 'Size', type: 'text', defaultValue: '1024x1024', placeholder: '1024x1024, 1792x1024, 1024x1792' },
        { id: 'quality', label: 'Quality', type: 'text', defaultValue: 'standard', placeholder: 'standard | hd' },
        { id: 'style', label: 'Style', type: 'text', defaultValue: 'vivid', placeholder: 'vivid | natural' },
        { id: 'responseFormat', label: 'Response format', type: 'text', defaultValue: 'url', placeholder: 'url | b64_json' },
      ],
      run: generate,
    },
  ],
};

registerForgeBlock(block);
export default block;
