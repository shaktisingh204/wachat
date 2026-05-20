/**
 * Forge block: Read/Write Files (SabFiles)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Files/ReadWriteFile/ReadWriteFile.node.ts
 *
 * The combined read+write node, routed through SabFiles. SabNode runs on
 * Vercel Fluid Compute (no persistent disk) and SabFiles is the only
 * tenant-isolated storage layer, so both operations transact against the
 * Rust BFF rather than the local filesystem.
 *
 *   • `read`  — fetch a SabFile by id, return its bytes as base64.
 *   • `write` — upload base64 bytes into the workspace's SabFile library
 *               (presign → PUT → confirm).
 *
 * For specialised flows (URL fetch, presigned-PUT, share tokens, folder
 * enumeration) prefer the dedicated blocks:
 *
 *   • `forge_read_binary_file`   → read_sabfile / read_sabfile_share / read_from_url
 *   • `forge_write_binary_file`  → write_sabfile / write_to_url
 *   • `forge_read_binary_files`  → read_sabfiles / read_folder / list_sabfiles
 *
 * Tenant identity flows through `ForgeActionContext.userId`, populated from
 * `flow.userId` by `executeFlow` → `executeBlock` → `executeForgeBlock`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

/**
 * Worker-safe Rust BFF call. Forge actions run inside the BullMQ worker
 * which has no Next.js request context (`cookies()` would throw), so we
 * sidestep the standard `rustFetch` and mint a JWT directly from
 * `ctx.userId`.
 */
async function rustWorkerFetch<T>(
  ctx: ForgeActionContext,
  path: string,
  init: RequestInit = { method: 'GET' },
): Promise<T> {
  if (!ctx.userId) {
    throw new Error('ReadWriteFile: ctx.userId missing — cannot mint Rust JWT.');
  }
  const { issueRustJwt } = await import('@/lib/jwt-for-rust');
  const token = await issueRustJwt({
    userId: ctx.userId,
    tenantId: ctx.userId,
    roles: [],
  });
  const base = process.env.RUST_API_URL || 'http://localhost:8080';
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  const res = await fetch(`${base}${path}`, { ...init, headers, cache: 'no-store' });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      detail = body.length > 300 ? `${body.slice(0, 300)}…` : body;
    } catch {
      /* ignore */
    }
    throw new Error(`ReadWriteFile: Rust BFF ${res.status} ${res.statusText} — ${detail}`);
  }
  return (await res.json()) as T;
}

async function read(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const id = asString(ctx.options.fileId).trim();
  if (!id) throw new Error('ReadWriteFile: fileId is required');

  const { url } = await rustWorkerFetch<{ url: string }>(
    ctx,
    `/v1/sabfiles/nodes/${encodeURIComponent(id)}/download`,
  );
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ReadWriteFile: SabFile fetch failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';

  return {
    outputs: {
      id,
      base64: buf.toString('base64'),
      bytes: buf.length,
      contentType,
    },
    logs: [`ReadWriteFile read → ${id} (${buf.length}B, ${contentType})`],
  };
}

async function write(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name).trim();
  const base64 = asString(ctx.options.base64Data);
  const contentType = asString(ctx.options.contentType) || 'application/octet-stream';
  const folderId = asString(ctx.options.folderId).trim();
  if (!name) throw new Error('ReadWriteFile: name is required');
  if (!base64) throw new Error('ReadWriteFile: base64Data is required');

  const buf = Buffer.from(base64, 'base64');
  const size = buf.length;
  if (size === 0) throw new Error('ReadWriteFile: decoded base64 payload is empty');

  type PresignResponse = {
    upload_url: string;
    key: string;
    method: string;
    headers: Record<string, string>;
    expires_in: number;
  };
  const presign = await rustWorkerFetch<PresignResponse>(ctx, '/v1/sabfiles/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      size,
      mime: contentType,
      parent_id: folderId || null,
    }),
  });

  const uploadHeaders = new Headers(presign.headers ?? {});
  if (!uploadHeaders.has('Content-Type')) {
    uploadHeaders.set('Content-Type', contentType);
  }
  const uploadRes = await fetch(presign.upload_url, {
    method: (presign.method || 'PUT').toUpperCase(),
    headers: uploadHeaders,
    body: new Uint8Array(buf),
  });
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    const clip = txt.length > 300 ? `${txt.slice(0, 300)}…` : txt;
    throw new Error(
      `ReadWriteFile: R2 upload failed (${uploadRes.status} ${uploadRes.statusText}): ${clip}`,
    );
  }

  type ConfirmResponse = {
    node: {
      _id: string;
      id: string;
      name: string;
      size?: number;
      mime?: string;
      r2Key?: string;
      parentId: string | null;
      createdAt: string;
    };
  };
  const confirmed = await rustWorkerFetch<ConfirmResponse>(ctx, '/v1/sabfiles/upload/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: presign.key,
      name,
      size,
      mime: contentType,
      parent_id: folderId || null,
    }),
  });

  return {
    outputs: {
      id: confirmed.node.id,
      name: confirmed.node.name,
      size: confirmed.node.size ?? size,
      mime: confirmed.node.mime ?? contentType,
      parentId: confirmed.node.parentId,
      createdAt: confirmed.node.createdAt,
    },
    logs: [
      `ReadWriteFile write → ${name} (${size}B, ${contentType}) → ${confirmed.node.id}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_read_write_file',
  name: 'Read/Write Files',
  description: 'Combined read + write of binary files via SabFiles.',
  iconName: 'LuHardDrive',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read',
      label: 'Read SabFile',
      description: 'Fetch a SabFile by id and return its bytes as base64.',
      fields: [
        {
          id: 'fileId',
          label: 'SabFile id',
          type: 'text',
          required: true,
          placeholder: 'sf_…',
        },
      ],
      run: read,
    },
    {
      id: 'write',
      label: 'Write SabFile',
      description:
        "Upload base64 bytes into the workspace's SabFile library (presign → PUT → confirm).",
      fields: [
        { id: 'name', label: 'File name', type: 'text', required: true, placeholder: 'report.pdf' },
        { id: 'base64Data', label: 'Base64 data', type: 'textarea', required: true },
        {
          id: 'contentType',
          label: 'Content-Type',
          type: 'text',
          placeholder: 'application/octet-stream',
        },
        {
          id: 'folderId',
          label: 'Folder ID (optional)',
          type: 'text',
          placeholder: 'Leave blank for root',
        },
      ],
      run: write,
    },
  ],
};

registerForgeBlock(block);
export default block;
