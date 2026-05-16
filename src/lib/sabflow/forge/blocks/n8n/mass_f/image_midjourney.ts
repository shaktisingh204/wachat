/**
 * Forge block: Image Midjourney
 *
 * NOTE: Midjourney does NOT publish an official HTTP API. This block targets a
 * configurable third-party proxy (e.g. UserAPI, ImagineAPI, GoAPI) that
 * implements a POST /imagine endpoint accepting `{ prompt }` and returning
 * either an `image_url`, `imageUrl`, or `data.url`. Supply the proxy's base URL
 * and bearer token. The endpoint is async on most proxies, so the response
 * may include a `task_id` instead of a finished image — both shapes are
 * surfaced under `outputs.raw`.
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { apiRequest, asString } from '../_shared/http';

type MJResponse = {
  image_url?: string;
  imageUrl?: string;
  url?: string;
  data?: { url?: string; image_url?: string };
  task_id?: string;
  taskId?: string;
};

async function imagine(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const apiKey = asString(ctx.options.apiKey);
  if (!apiKey) throw new Error('Midjourney: apiKey is required');
  const baseUrl = asString(ctx.options.baseUrl);
  if (!baseUrl) throw new Error('Midjourney: baseUrl (proxy URL) is required');
  const prompt = asString(ctx.options.prompt);
  if (!prompt) throw new Error('Midjourney: prompt is required');
  const path = asString(ctx.options.path) || '/imagine';

  const res = await apiRequest({
    service: 'Midjourney',
    method: 'POST',
    url: `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`,
    headers: { Authorization: `Bearer ${apiKey}` },
    json: { prompt },
  });
  const body = res.data as MJResponse;
  const url = body?.image_url ?? body?.imageUrl ?? body?.url ?? body?.data?.url ?? body?.data?.image_url ?? '';
  const taskId = body?.task_id ?? body?.taskId ?? '';
  return {
    outputs: { url, b64: '', taskId, raw: res.data },
    logs: [`Midjourney /imagine → ${url || taskId || 'queued'}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_image_midjourney',
  name: 'Image Midjourney',
  description: 'Generate a Midjourney image via a third-party proxy API (no official API).',
  iconName: 'LuImage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'imagine',
      label: 'Imagine',
      description: 'Send /imagine prompt to a Midjourney proxy. Output: `url` if sync, `taskId` if async.',
      fields: [
        { id: 'apiKey', label: 'Proxy API key', type: 'password', required: true },
        { id: 'baseUrl', label: 'Proxy base URL', type: 'text', required: true, placeholder: 'https://api.example-mj-proxy.com' },
        { id: 'path', label: 'Imagine path', type: 'text', defaultValue: '/imagine' },
        { id: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      ],
      run: imagine,
    },
  ],
};

registerForgeBlock(block);
export default block;
