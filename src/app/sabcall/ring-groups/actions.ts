'use server';

/**
 * SabCall ring groups — project-scoped CRUD (direct Mongo).
 *
 * Tenanted by the active SabCall project id (stored in the `userId` field),
 * consistent with `sabcall.actions.ts` and exactly what `sabcall-engine` reads
 * when generating dialplan config. Direct Mongo (not the Rust crate) is the
 * primary path because the crate's `user_oid` scope keys off the JWT subject
 * (the session user), which would not isolate per project.
 */

import { makeSabcallResource, type ResourceListParams } from '@/lib/sabcall/resource-crud';

export interface RingGroupDoc {
  _id: string;
  userId?: string;
  name: string;
  strategy: string;
  extensions: string[];
  ringSeconds?: number;
  fallback?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

const resource = makeSabcallResource('sabcall_ring_groups', {
  searchFields: ['name'],
  revalidate: '/sabcall/ring-groups',
});

export async function listRingGroups(
  params?: ResourceListParams,
): Promise<{ items: RingGroupDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: RingGroupDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createRingGroup(
  input: Partial<RingGroupDoc>,
): Promise<{ id: string; entity: RingGroupDoc }> {
  return (await resource.create(input as Record<string, unknown>)) as unknown as {
    id: string;
    entity: RingGroupDoc;
  };
}

export async function updateRingGroup(
  id: string,
  patch: Partial<RingGroupDoc>,
): Promise<RingGroupDoc | null> {
  return (await resource.update(id, patch as Record<string, unknown>)) as unknown as RingGroupDoc | null;
}

export async function deleteRingGroup(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
