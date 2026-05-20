/**
 * Forge block: WriteBinaryFile
 *
 * Source: n8n-master/packages/nodes-base/nodes/WriteBinaryFile/WriteBinaryFile.node.ts
 *
 * Routes every write through SabFiles instead of the host filesystem.
 * SabNode runs on Vercel Fluid Compute (no persistent disk) and SabFiles
 * is the canonical, tenant-isolated storage layer.
 *
 * Modes:
 *   • `write_sabfile`  — upload bytes into the caller's SabFile library
 *                        (presign → PUT → confirm). Worker-safe JWT is
 *                        minted from `ctx.userId`.
 *   • `write_to_url`   — generic presigned-URL uploader (S3 / R2 / GCS)
 *                        when the caller already holds a presigned URL.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

/**
 * Mint a short-lived Rust JWT for the calling workspace and POST `path` with
 * the supplied JSON body, returning the typed response.
 *
 * Forge actions run inside the BullMQ worker which has no Next.js request
 * context (`cookies()` would throw). We therefore bypass `rustFetch` and call
 * the BFF directly with a JWT issued from `ctx.userId`.
 */
async function rustWorkerFetch<T>(
  ctx: ForgeActionContext,
  path: string,
  init: RequestInit,
): Promise<T> {
  if (!ctx.userId) {
    throw new Error('WriteBinaryFile: ctx.userId missing — cannot mint Rust JWT.');
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
    throw new Error(`WriteBinaryFile: Rust BFF ${res.status} ${res.statusText} — ${detail}`);
  }
  return (await res.json()) as T;
}

async function writeSabfile(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const name = asString(ctx.options.name).trim();
  const base64 = asString(ctx.options.base64Data);
  const contentType = asString(ctx.options.contentType) || 'application/octet-stream';
  const folderId = asString(ctx.options.folderId).trim();
  if (!name) throw new Error('WriteBinaryFile: name is required');
  if (!base64) throw new Error('WriteBinaryFile: base64Data is required');
  if (!ctx.userId) {
    throw new Error(
      'WriteBinaryFile: caller userId is missing — SabFile uploads require authenticated context.',
    );
  }

  const buf = Buffer.from(base64, 'base64');
  const size = buf.length;
  if (size === 0) throw new Error('WriteBinaryFile: decoded base64 payload is empty');

  // 1. Presign — get an upload URL + R2 key from the BFF.
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

  // 2. Upload bytes directly to R2 with the presigned URL. The BFF returns
  //    the exact method + headers required (typically PUT with content-type),
  //    so we forward them verbatim.
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
      `WriteBinaryFile: R2 upload failed (${uploadRes.status} ${uploadRes.statusText}): ${clip}`,
    );
  }

  // 3. Confirm — record the new node in the SabFiles collection.
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
      `WriteBinaryFile write_sabfile → ${name} (${size}B, ${contentType}) → ${confirmed.node.id}`,
    ],
  };
}

async function writeToUrl(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const url = asString(ctx.options.url);
  const base64 = asString(ctx.options.base64Data);
  const contentType = asString(ctx.options.contentType) || 'application/octet-stream';
  const method = (asString(ctx.options.method) || 'PUT').toUpperCase();
  if (!url) throw new Error('WriteBinaryFile: url is required');
  if (!base64) throw new Error('WriteBinaryFile: base64Data is required');

  const buf = Buffer.from(base64, 'base64');
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': contentType },
    body: new Uint8Array(buf),
  });
  if (!res.ok) {
    const txt = await res.text();
    const clip = txt.length > 300 ? `${txt.slice(0, 300)}…` : txt;
    throw new Error(`WriteBinaryFile: ${method} ${url} failed (${res.status}): ${clip}`);
  }
  return {
    outputs: { status: res.status, bytes: buf.length },
    logs: [`WriteBinaryFile write_to_url → ${buf.length}B (${res.status})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_write_binary_file',
  name: 'Write Binary File',
  description: 'Write a binary file into SabFiles or push to a presigned URL.',
  iconName: 'LuFileUp',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'write_sabfile',
      label: 'Write SabFile',
      description:
        "Upload base64 bytes into the workspace's SabFile library (presign → PUT → confirm).",
      fields: [
        { id: 'name', label: 'File name', type: 'text', required: true, placeholder: 'report.pdf' },
        { id: 'base64Data', label: 'Base64 data', type: 'textarea', required: true },
        { id: 'contentType', label: 'Content-Type', type: 'text', placeholder: 'application/octet-stream' },
        { id: 'folderId', label: 'Folder ID (optional)', type: 'text', placeholder: 'Leave blank for root' },
      ],
      run: writeSabfile,
    },
    {
      id: 'write_to_url',
      label: 'Write to presigned URL',
      description: 'PUT/POST base64 bytes to a presigned URL (S3 / R2 / GCS).',
      fields: [
        { id: 'url', label: 'Presigned URL', type: 'text', required: true },
        { id: 'base64Data', label: 'Base64 data', type: 'textarea', required: true },
        { id: 'contentType', label: 'Content-Type', type: 'text', placeholder: 'application/octet-stream' },
        {
          id: 'method',
          label: 'HTTP method',
          type: 'select',
          defaultValue: 'PUT',
          options: [
            { label: 'PUT', value: 'PUT' },
            { label: 'POST', value: 'POST' },
          ],
        },
      ],
      run: writeToUrl,
    },
  ],
};

registerForgeBlock(block);
export default block;
