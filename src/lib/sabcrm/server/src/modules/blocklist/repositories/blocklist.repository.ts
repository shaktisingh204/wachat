// PORT-NOTE: Adapted from twenty-server/src/modules/blocklist/repositories/blocklist.repository.ts
// NestJS repository converted to plain exported functions backed by MongoDB.

import "server-only";

import { getBlocklistCollection, type BlocklistDocument } from "@/lib/sabcrm/server/src/modules/blocklist/standard-objects/blocklist.workspace-entity";

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

export async function getBlocklistById(
  id: string,
  workspaceId: string,
): Promise<BlocklistDocument | null> {
  const collection = await getBlocklistCollection();
  return collection.findOne({ id, workspaceId });
}

export async function getBlocklistByWorkspaceMemberId(
  workspaceMemberId: string,
  workspaceId: string,
): Promise<BlocklistDocument[]> {
  const collection = await getBlocklistCollection();
  return collection.find({ workspaceMemberId, workspaceId }).toArray();
}

// ---------------------------------------------------------------------------
// Class façade (matches original API surface)
// ---------------------------------------------------------------------------

export class BlocklistRepository {
  async getById(
    id: string,
    workspaceId: string,
  ): Promise<BlocklistDocument | null> {
    return getBlocklistById(id, workspaceId);
  }

  async getByWorkspaceMemberId(
    workspaceMemberId: string,
    workspaceId: string,
  ): Promise<BlocklistDocument[]> {
    return getBlocklistByWorkspaceMemberId(workspaceMemberId, workspaceId);
  }
}
