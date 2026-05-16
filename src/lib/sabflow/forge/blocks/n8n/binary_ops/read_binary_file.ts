/**
 * Forge block: ReadBinaryFile
 *
 * Source: n8n-master/packages/nodes-base/nodes/ReadBinaryFile/ReadBinaryFile.node.ts
 *
 * STATUS:
 *   • `read`             — disk-IO stub; remains disabled. Tenant isolation
 *                          prevents arbitrary server-side disk access.
 *   • `read_from_url`    — HTTPS fetcher; works for any public URL including
 *                          a `/api/sabfiles/raw/<id>` link issued in-session.
 *   • `read_sabfile`     — NEW: pulls a SabFile by its public share token via
 *                          the Rust BFF's `/v1/sabfiles/share/<token>/...`
 *                          endpoints. No session cookie needed (forge blocks
 *                          run inside the BullMQ worker, which has no Next.js
 *                          request context).
 *
 *   Calling `rustClient.sabfiles.*` directly is NOT viable from a forge
 *   action: that path mints a session-scoped JWT via `cookies()`, which is
 *   undefined in the worker. The share-token surface is the safe bridge —
 *   the user explicitly opts a file in by sharing it.
 */

import { registerForgeBlock } from '../../../registry';
import { rustPublicFetch } from '@/lib/rust-client/fetcher';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function read(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(
    'ReadBinaryFile: server-side file IO is disabled in SabFlow. Use the read_sabfile action or SabFiles via @/components/sabfiles.',
  );
}

async function readFromUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  if (!url) throw new Error('ReadBinaryFile: url is required');
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ReadBinaryFile: fetch ${url} failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  return {
    outputs: {
      base64: buf.toString('base64'),
      bytes: buf.length,
      contentType,
    },
    logs: [`ReadBinaryFile read_from_url → ${buf.length}B (${contentType})`],
  };
}

/**
 * Read a SabFile by its public share token via the Rust BFF.
 *
 * The Rust BFF exposes `/v1/sabfiles/share/<token>/download` which returns
 * `{ url }` — a short-lived presigned R2 GET URL. We resolve it and then
 * stream the bytes back as base64. Optional `password` is forwarded as a
 * query param for password-protected shares.
 *
 * Why a share token (not a file id)? Tenant scoping. Forge actions run in
 * the BullMQ worker with no Next.js request context, so the session-cookie
 * fetcher (`rustClient.sabfiles.download(id)`) is unavailable. The
 * share-token endpoints are explicitly public on the BFF side, so the user
 * opts a file in by sharing it before referencing it from a flow.
 */
async function readSabfileShare(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = asString(ctx.options.shareToken);
  const password = asString(ctx.options.password);
  if (!token) throw new Error('ReadBinaryFile: shareToken is required');

  const qs = password ? `?password=${encodeURIComponent(password)}` : '';
  const { url } = await rustPublicFetch<{ url: string }>(
    `/v1/sabfiles/share/${encodeURIComponent(token)}/download${qs}`,
  );

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ReadBinaryFile: SabFile fetch failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';

  return {
    outputs: {
      base64: buf.toString('base64'),
      bytes: buf.length,
      contentType,
      shareToken: token,
    },
    logs: [`ReadBinaryFile read_sabfile → ${buf.length}B (${contentType})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_read_binary_file',
  name: 'Read Binary File',
  description: 'Read a binary file from a SabFiles share, a URL, or (disabled) the host disk.',
  iconName: 'LuFileDown',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read',
      label: 'Read from disk (disabled)',
      description: 'Disabled in SabFlow. Use SabFiles for tenant-isolated storage.',
      fields: [
        { id: 'filePath', label: 'File path', type: 'text', placeholder: '/tmp/disabled' },
      ],
      run: read,
    },
    {
      id: 'read_from_url',
      label: 'Read from URL',
      description: 'Fetch an HTTPS URL and return its bytes as base64.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://...' },
      ],
      run: readFromUrl,
    },
    {
      id: 'read_sabfile',
      label: 'Read SabFile (by share token)',
      description:
        'Pull bytes for a SabFile via its public share token. Create the share in @/components/sabfiles before referencing it here.',
      fields: [
        {
          id: 'shareToken',
          label: 'SabFile share token',
          type: 'text',
          required: true,
          placeholder: 'sf_abcdef…',
        },
        {
          id: 'password',
          label: 'Share password (optional)',
          type: 'password',
          placeholder: 'Only for password-protected shares',
        },
      ],
      run: readSabfileShare,
    },
  ],
};

registerForgeBlock(block);
export default block;
