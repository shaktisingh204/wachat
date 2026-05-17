/**
 * Forge block: ReadBinaryFiles
 *
 * Source: n8n-master/packages/nodes-base/nodes/ReadBinaryFiles/ReadBinaryFiles.node.ts
 *
 * STATUS:
 *   • `read`           — disk-IO; remains disabled by policy.
 *   • `list_sabfiles`  — enumerate the caller workspace's SabFile nodes via
 *                        the Rust BFF, with a worker-safe JWT minted from
 *                        `ctx.userId`. Optional `folderId` scopes the list
 *                        to a single folder; otherwise the root is listed.
 *                        Files only (folders are filtered out so downstream
 *                        blocks can fan out over real bytes).
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function read(_ctx: ForgeActionContext): Promise<ForgeActionResult> {
  throw new Error(
    'ReadBinaryFiles: server-side file IO is disabled in SabFlow. Use SabFiles via the @/components/sabfiles components for tenant-isolated storage.',
  );
}

/**
 * Worker-safe Rust BFF call.  Forge actions run inside the BullMQ worker
 * which has no Next.js request context (`cookies()` would throw), so we
 * sidestep the standard `rustFetch` and mint a JWT directly from
 * `ctx.userId`.
 */
async function rustWorkerGet<T>(ctx: ForgeActionContext, path: string): Promise<T> {
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
    throw new Error(`ReadBinaryFiles: Rust BFF ${res.status} ${res.statusText} — ${detail}`);
  }
  return (await res.json()) as T;
}

async function listSabfiles(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  if (!ctx.userId) {
    throw new Error(
      'ReadBinaryFiles list_sabfiles: caller userId is missing — SabFile listing requires authenticated context.',
    );
  }
  const folderId = asString(ctx.options.folderId).trim();
  const query = asString(ctx.options.query).trim();

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
  type SabfilesNodesResponse = { nodes: SabfilesNode[] };

  const params = new URLSearchParams();
  if (folderId) params.set('parent', folderId);
  if (query) params.set('query', query);
  const qs = params.toString();
  const path = `/v1/sabfiles/nodes${qs ? `?${qs}` : ''}`;
  const { nodes } = await rustWorkerGet<SabfilesNodesResponse>(ctx, path);

  // Only return file nodes — downstream blocks expect bytes, not folders.
  // Also strip server-internal fields (`r2Key`, etc.) so flows don't leak
  // them via variables.
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
  description: 'List SabFile entries (filtered to files). Disk IO is disabled.',
  iconName: 'LuFiles',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'read',
      label: 'Read from disk (disabled)',
      description: 'Disabled in SabFlow. Use SabFiles for tenant-isolated storage.',
      fields: [
        { id: 'glob', label: 'Glob pattern', type: 'text', placeholder: '/data/*.png' },
      ],
      run: read,
    },
    {
      id: 'list_sabfiles',
      label: 'List SabFiles',
      description:
        'Enumerate file entries from the workspace SabFile library. Optionally scope to a folder or search by name.',
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
