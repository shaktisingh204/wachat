/**
 * Forge block: Compression
 *
 * Source: n8n-master/packages/nodes-base/nodes/Compression/Compression.node.ts
 *
 * Pure Node.js zlib — no external deps. Operates on UTF-8 text in/out and
 * base64 for the compressed payload.
 *
 * Operations covered:
 *   - gzip    text → base64(gzip)
 *   - gunzip  base64(gzip) → text
 */

import { gunzipSync, gzipSync } from 'node:zlib';

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function gzip(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const text = asString(ctx.options.text);
  if (!text) throw new Error('Compression: text is required');
  const buf = gzipSync(Buffer.from(text, 'utf8'));
  return {
    outputs: { base64: buf.toString('base64'), bytes: buf.length },
    logs: [`Compression gzip → ${text.length}B in / ${buf.length}B out`],
  };
}

async function gunzip(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const b64 = asString(ctx.options.base64);
  if (!b64) throw new Error('Compression: base64 is required');
  const buf = gunzipSync(Buffer.from(b64, 'base64'));
  const text = buf.toString('utf8');
  return {
    outputs: { text, bytes: buf.length },
    logs: [`Compression gunzip → ${b64.length}B in / ${buf.length}B out`],
  };
}

const block: ForgeBlock = {
  id: 'forge_compression',
  name: 'Compression',
  description: 'Gzip / gunzip text payloads using Node zlib.',
  iconName: 'LuArchive',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'gzip',
      label: 'Gzip text',
      description: 'Gzip a UTF-8 text and return a base64-encoded payload.',
      fields: [
        { id: 'text', label: 'Text', type: 'textarea', required: true },
      ],
      run: gzip,
    },
    {
      id: 'gunzip',
      label: 'Gunzip text',
      description: 'Decode a base64 gzip payload and return the UTF-8 text.',
      fields: [
        { id: 'base64', label: 'Base64 payload', type: 'textarea', required: true },
      ],
      run: gunzip,
    },
  ],
};

registerForgeBlock(block);
export default block;
