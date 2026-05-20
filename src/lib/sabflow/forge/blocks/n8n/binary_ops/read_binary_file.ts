/**
 * Forge block: ReadBinaryFile
 *
 * Source: n8n-master/packages/nodes-base/nodes/ReadBinaryFile/ReadBinaryFile.node.ts
 *
 * Routes every read through SabFiles instead of the host filesystem.
 * SabNode runs on Vercel Fluid Compute, which has no persistent disk and no
 * tenant-isolated filesystem; SabFiles is the canonical storage layer and
 * also enforces workspace scoping.
 *
 * Modes:
 *   • `read_sabfile`      — fetch by SabFile id (authenticated via the
 *                           worker-safe Rust JWT minted from `ctx.userId`).
 *   • `read_sabfile_share`— fetch by public share token (no `ctx.userId`
 *                           required, useful for cross-workspace handoffs).
 *   • `read_from_url`     — plain HTTPS fetch for arbitrary remote URLs.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

/**
 * Worker-safe Rust BFF call. Forge actions execute inside the BullMQ worker
 * which has no Next.js request context, so the standard `rustFetch`
 * (depends on `cookies()`) is unusable here. We mint a short-lived JWT
 * from `ctx.userId` instead.
 */
async function rustWorkerGet<T>(ctx: ForgeActionContext, path: string): Promise<T> {
  if (!ctx.userId) {
    throw new Error('ReadBinaryFile: ctx.userId missing — cannot mint Rust JWT.');
  }
  const { issueRustJwt } = await import('@/lib/jwt-for-rust');
  const token = await issueRustJwt({
    userId: ctx.userId,
    tenantId: ctx.userId,
    roles: [],
  });
  const base = process.env.RUST_API_URL || 'http://localhost:8080';
  const res = await fetch(`${base}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      detail = body.length > 300 ? `${body.slice(0, 300)}…` : body;
    } catch {
      /* ignore */
    }
    throw new Error(`ReadBinaryFile: Rust BFF ${res.status} ${res.statusText} — ${detail}`);
  }
  return (await res.json()) as T;
}

/** Resolve a presigned URL into a buffer + content-type. */
async function fetchPresigned(presignedUrl: string): Promise<{ buf: Buffer; contentType: string }> {
  const res = await fetch(presignedUrl);
  if (!res.ok) {
    throw new Error(`ReadBinaryFile: SabFile fetch failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  return { buf, contentType };
}

async function readSabfile(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.fileId).trim();
  if (!id) throw new Error('ReadBinaryFile: fileId is required');

  const { url } = await rustWorkerGet<{ url: string }>(
    ctx,
    `/v1/sabfiles/nodes/${encodeURIComponent(id)}/download`,
  );
  const { buf, contentType } = await fetchPresigned(url);

  return {
    outputs: {
      id,
      base64: buf.toString('base64'),
      bytes: buf.length,
      contentType,
    },
    logs: [`ReadBinaryFile read_sabfile → ${id} (${buf.length}B, ${contentType})`],
  };
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
 * Read a SabFile by its public share token.
 *
 * The share-token surface is explicitly public on the BFF side; the user
 * opts a file in by minting a share token from the SabFiles UI before
 * referencing it from a flow. No `ctx.userId` required, which makes this
 * suitable for cross-workspace or unauthenticated-trigger handoffs.
 */
async function readSabfileShare(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const token = asString(ctx.options.shareToken);
  const password = asString(ctx.options.password);
  if (!token) throw new Error('ReadBinaryFile: shareToken is required');

  const qs = password ? `?password=${encodeURIComponent(password)}` : '';
  const { rustPublicFetch } = await import('@/lib/rust-client/fetcher');
  const { url } = await rustPublicFetch<{ url: string }>(
    `/v1/sabfiles/share/${encodeURIComponent(token)}/download${qs}`,
  );

  const { buf, contentType } = await fetchPresigned(url);

  return {
    outputs: {
      base64: buf.toString('base64'),
      bytes: buf.length,
      contentType,
      shareToken: token,
    },
    logs: [`ReadBinaryFile read_sabfile_share → ${buf.length}B (${contentType})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_read_binary_file',
  name: 'Read Binary File',
  description: 'Read a binary file from SabFiles (by id or share token) or any HTTPS URL.',
  iconName: 'LuFileDown',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read_sabfile',
      label: 'Read SabFile (by id)',
      description:
        'Fetch a SabFile from the workspace library by its id. Returns the raw bytes as base64.',
      fields: [
        {
          id: 'fileId',
          label: 'SabFile id',
          type: 'resourceLocator',
          required: true,
          placeholder: 'sf_…',
          modes: [
            { name: 'id', displayName: 'By id', type: 'string', placeholder: 'sf_…' },
            {
              name: 'url',
              displayName: 'By URL',
              type: 'string',
              placeholder: 'https://.../sabfiles/.../<id>',
              extractValue: { type: 'regex', regex: '/sabfiles/[^/]+/([^/?#]+)' },
            },
          ],
        },
      ],
      run: readSabfile,
    },
    {
      id: 'read_sabfile_share',
      label: 'Read SabFile (by share token)',
      description:
        'Pull bytes for a SabFile via its public share token. Mint the share in @/components/sabfiles before referencing it.',
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
    {
      id: 'read_from_url',
      label: 'Read from URL',
      description: 'Fetch an HTTPS URL and return its bytes as base64.',
      fields: [
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://...' },
      ],
      run: readFromUrl,
    },
  ],
};

registerForgeBlock(block);
export default block;
