'use client';

/**
 * Client-side helper for fetching forge block metadata.
 *
 * The server-side `@/lib/sabflow/forge` barrel is `server-only` (it pulls in
 * Mongo/pg/ssh2-sftp-client/etc. via transitive runtime imports). Client
 * components must use this helper instead, which fetches from
 * `/api/sabflow/forge-metadata`.
 *
 * The metadata is fetched once, cached for the session, and returned to all
 * subsequent callers.
 */

import type { ForgeBlock } from './types';

/** A serializable subset of `ForgeBlock` (no `run` functions). */
export type ForgeBlockMetadata = Omit<ForgeBlock, 'actions'> & {
  actions?: Array<Omit<NonNullable<ForgeBlock['actions']>[number], 'run'>>;
};

let cachedBlocks: Record<string, ForgeBlockMetadata> | null = null;
let inflight: Promise<Record<string, ForgeBlockMetadata>> | null = null;

async function loadBlocks(): Promise<Record<string, ForgeBlockMetadata>> {
  if (cachedBlocks) return cachedBlocks;
  if (inflight) return inflight;
  inflight = fetch('/api/sabflow/forge-metadata', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`forge-metadata: ${res.status}`);
      const json = (await res.json()) as { blocks?: Record<string, ForgeBlockMetadata> };
      const blocks = json.blocks ?? {};
      cachedBlocks = blocks;
      return blocks;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Eager warm — returns the same promise as `loadBlocks`. */
export function preloadForgeMetadata(): Promise<Record<string, ForgeBlockMetadata>> {
  return loadBlocks();
}

/** Returns the metadata for `id` once the registry is loaded. */
export async function getForgeBlockMetadata(id: string): Promise<ForgeBlockMetadata | undefined> {
  const blocks = await loadBlocks();
  return blocks[id];
}

/** Synchronous lookup — returns undefined until the registry has been fetched. */
export function getForgeBlockMetadataSync(id: string): ForgeBlockMetadata | undefined {
  return cachedBlocks?.[id];
}

/** Returns the loaded registry, or undefined if not yet fetched. */
export function getAllForgeBlocksMetadataSync(): Record<string, ForgeBlockMetadata> | undefined {
  return cachedBlocks ?? undefined;
}
