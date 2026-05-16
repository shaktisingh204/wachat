/**
 * Forge block: EditImage
 *
 * Source: n8n-master/packages/nodes-base/nodes/EditImage/EditImage.node.ts
 *
 * STUB / DEFERRED: The original n8n node uses `gm`/`graphicsmagick` and
 * `sharp` (native libs) for image manipulation. Those binaries are not
 * available in the SabFlow runtime, so this port returns a generated
 * placeholder URL via the public dummyimage.com service for the
 * "create-placeholder" path and otherwise echoes the source URL.
 *
 * A future revision should integrate Cloudflare Images or sharp-wasm to
 * provide full crop/resize/composite/text operations.
 *
 * Operations covered (subset):
 *   - placeholder.create  GET https://dummyimage.com/{w}x{h}/{bg}/{fg}.png&text={text}
 *   - info                returns metadata for a remote image URL via HEAD
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function placeholderCreate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const width = asString(ctx.options.width) || '600';
  const height = asString(ctx.options.height) || '400';
  const bg = asString(ctx.options.background) || 'cccccc';
  const fg = asString(ctx.options.foreground) || '000000';
  const text = asString(ctx.options.text);
  const params = new URLSearchParams();
  if (text) params.set('text', text);
  const qs = params.toString();
  const url = `https://dummyimage.com/${encodeURIComponent(width)}x${encodeURIComponent(height)}/${encodeURIComponent(bg)}/${encodeURIComponent(fg)}.png${qs ? `&${qs}` : ''}`;
  return {
    outputs: { url, width, height },
    logs: [`EditImage placeholder → ${width}x${height}`],
  };
}

async function info(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.imageUrl);
  if (!url) throw new Error('EditImage: imageUrl is required');
  const res = await fetch(url, { method: 'HEAD' });
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    headers[k] = v;
  });
  return {
    outputs: { ok: res.ok, status: res.status, headers },
    logs: [`EditImage info → ${url}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_edit_image',
  name: 'Edit Image',
  description: 'Image utilities (stub — sharp/gm not available in SabFlow runtime).',
  iconName: 'LuImage',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'placeholder_create',
      label: 'Create placeholder image',
      description: 'Generate a placeholder image URL via dummyimage.com.',
      fields: [
        { id: 'width', label: 'Width', type: 'number', defaultValue: 600 },
        { id: 'height', label: 'Height', type: 'number', defaultValue: 400 },
        { id: 'background', label: 'Background hex (no #)', type: 'text', defaultValue: 'cccccc' },
        { id: 'foreground', label: 'Foreground hex (no #)', type: 'text', defaultValue: '000000' },
        { id: 'text', label: 'Text overlay', type: 'text' },
      ],
      run: placeholderCreate,
    },
    {
      id: 'info',
      label: 'Get image info',
      description: 'HEAD a remote image URL and return its content-type/length headers.',
      fields: [
        { id: 'imageUrl', label: 'Image URL', type: 'text', required: true },
      ],
      run: info,
    },
  ],
};

registerForgeBlock(block);
export default block;
