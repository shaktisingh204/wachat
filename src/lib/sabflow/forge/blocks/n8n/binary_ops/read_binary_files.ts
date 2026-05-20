/**
 * Forge block: ReadBinaryFiles
 *
 * Source: n8n-master/packages/nodes-base/nodes/ReadBinaryFiles/ReadBinaryFiles.node.ts
 *
 * Routes every read through SabFiles instead of the host filesystem (no
 * persistent disk on Vercel Fluid Compute, and tenant isolation requires it).
 *
 * Modes:
 *   • `read_sabfiles`   — accept an explicit array of SabFile ids and fetch
 *                         each in parallel. Returns an array of `{ id, name,
 *                         base64, bytes, contentType }`.
 *   • `read_folder`     — enumerate a SabFile folder, then fetch every file
 *                         inside it (one level, files only). Equivalent to
 *                         n8n's glob mode but rooted in SabFiles.
 *   • `list_sabfiles`   — metadata-only listing (no bytes), kept for callers
 *                         that just want to fan out node ids downstream.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function rustWorkerFetch<T>(
  ctx: ForgeActionContext,
  path: string,
  init: RequestInit = { method: 'GET' },
): Promise<T> {
  if (!ctx.userId) {
    throw new Error('ReadBinaryFiles: ctx.userId missing — cannot mint Rust JWT.');
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
    throw new Error(`ReadBinaryFiles: Rust BFF ${res.status} ${res.statusText} — ${detail}`);
  }
  return (await res.json()) as T;
}

type SabfilesNode = {
  id: string;
  parentId: string | null;
  type: 'file' | 'folder';
  name: string;
  size?: number;
  mime?: string;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
};

type BinaryFile = {
  id: string;
  name: string;
  base64: string;
  bytes: number;
  contentType: string;
};

/** Coerce `ctx.options.fileIds` (string list OR comma string OR JSON) to ids. */
function coerceIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => asString(v).trim()).filter(Boolean);
  }
  const s = asString(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      /* fall through to CSV */
    }
  }
  return s.split(/[,\s]+/).map((v) => v.trim()).filter(Boolean);
}

/** Fetch one SabFile's bytes via the BFF presigned-download endpoint. */
async function fetchOne(ctx: ForgeActionContext, id: string, name?: string): Promise<BinaryFile> {
  const { url } = await rustWorkerFetch<{ url: string }>(
    ctx,
    `/v1/sabfiles/nodes/${encodeURIComponent(id)}/download`,
  );
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ReadBinaryFiles: SabFile ${id} fetch failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  return {
    id,
    name: name ?? id,
    base64: buf.toString('base64'),
    bytes: buf.length,
    contentType,
  };
}

async function readSabfiles(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const ids = coerceIdList(ctx.options.fileIds);
  if (ids.length === 0) throw new Error('ReadBinaryFiles: fileIds is required');

  // Parallel fetch keeps wall time bounded by the slowest single download;
  // R2 presigns are cheap so the BFF round-trips fan out fine.
  const files = await Promise.all(ids.map((id) => fetchOne(ctx, id)));
  const totalBytes = files.reduce((acc, f) => acc + f.bytes, 0);

  return {
    outputs: {
      files,
      count: files.length,
      totalBytes,
    },
    logs: [`ReadBinaryFiles read_sabfiles → ${files.length} file(s), ${totalBytes}B total`],
  };
}

async function readFolder(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const folderId = asString(ctx.options.folderId).trim();
  if (!folderId) throw new Error('ReadBinaryFiles: folderId is required');

  type SabfilesNodesResponse = { nodes: SabfilesNode[] };
  const { nodes } = await rustWorkerFetch<SabfilesNodesResponse>(
    ctx,
    `/v1/sabfiles/nodes?parent=${encodeURIComponent(folderId)}`,
  );

  const fileNodes = (nodes ?? []).filter((n) => n.type === 'file');
  const files = await Promise.all(fileNodes.map((n) => fetchOne(ctx, n.id, n.name)));
  const totalBytes = files.reduce((acc, f) => acc + f.bytes, 0);

  return {
    outputs: {
      files,
      count: files.length,
      totalBytes,
      folderId,
    },
    logs: [
      `ReadBinaryFiles read_folder → ${files.length} file(s) in folder ${folderId}, ${totalBytes}B total`,
    ],
  };
}

async function listSabfiles(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  if (!ctx.userId) {
    throw new Error(
      'ReadBinaryFiles list_sabfiles: caller userId is missing — SabFile listing requires authenticated context.',
    );
  }
  const folderId = asString(ctx.options.folderId).trim();
  const query = asString(ctx.options.query).trim();

  type SabfilesNodesResponse = { nodes: SabfilesNode[] };
  const params = new URLSearchParams();
  if (folderId) params.set('parent', folderId);
  if (query) params.set('query', query);
  const qs = params.toString();
  const { nodes } = await rustWorkerFetch<SabfilesNodesResponse>(
    ctx,
    `/v1/sabfiles/nodes${qs ? `?${qs}` : ''}`,
  );

  // Only files; strip server-internal fields so flows don't leak them via vars.
  const files = (nodes ?? [])
    .filter((n) => n.type === 'file')
    .map((n) => ({
      id: n.id,
      name: n.name,
      size: n.size ?? 0,
      mime: n.mime ?? 'application/octet-stream',
      parentId: n.parentId,
      shareToken: n.shareToken,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));

  return {
    outputs: {
      files,
      count: files.length,
      folderId: folderId || null,
    },
    logs: [
      `ReadBinaryFiles list_sabfiles → ${files.length} file(s)${
        folderId ? ` in folder ${folderId}` : ' in root'
      }${query ? ` matching "${query}"` : ''}`,
    ],
  };
}

const block: ForgeBlock = {
  id: 'forge_read_binary_files',
  name: 'Read Binary Files',
  description: 'Read multiple SabFile entries by id list or by folder id.',
  iconName: 'LuFiles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read_sabfiles',
      label: 'Read SabFiles (by ids)',
      description:
        'Fetch the bytes for an explicit list of SabFile ids in parallel. Accepts a JSON array, comma list, or expression resolving to an array.',
      fields: [
        {
          id: 'fileIds',
          label: 'SabFile ids',
          type: 'textarea',
          required: true,
          placeholder: 'sf_abc, sf_def  — or  ["sf_abc","sf_def"]',
        },
      ],
      run: readSabfiles,
    },
    {
      id: 'read_folder',
      label: 'Read SabFile folder',
      description:
        'Enumerate a SabFile folder (files only, single level) and fetch the bytes of every file inside it.',
      fields: [
        {
          id: 'folderId',
          label: 'Folder ID',
          type: 'text',
          required: true,
          placeholder: 'sf_folder_…',
        },
      ],
      run: readFolder,
    },
    {
      id: 'list_sabfiles',
      label: 'List SabFiles (metadata only)',
      description:
        'Enumerate file entries from the workspace SabFile library without downloading bytes. Optionally scope to a folder or search by name.',
      fields: [
        {
          id: 'folderId',
          label: 'Folder ID (optional)',
          type: 'text',
          placeholder: 'Leave blank for root',
        },
        {
          id: 'query',
          label: 'Search query (optional)',
          type: 'text',
          placeholder: 'Match by file name',
        },
      ],
      run: listSabfiles,
    },
  ],
};

registerForgeBlock(block);
export default block;
