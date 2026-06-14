'use server';

/**
 * SabCall SIP trunks — project-scoped CRUD (direct Mongo).
 *
 * Tenanted by the active SabCall project id (stored in the `userId` field),
 * consistent with `sabcall.actions.ts` and exactly what `sabcall-engine` reads
 * when generating pjsip config. Direct Mongo (not the Rust crate) is the
 * primary path because the crate's `user_oid` scope keys off the JWT subject
 * (the session user), which would not isolate per project.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';
import type {
  SipTrunkDoc,
  SipTrunkListParams,
  SipTrunkCreateInput,
  SipTrunkUpdateInput,
} from '@/lib/rust-client/sabcall-trunks';

const resource = makeSabcallResource('sabcall_trunks', {
  searchFields: ['name', 'sipServer', 'fromDomain'],
  revalidate: '/sabcall/trunks',
  extraFilters: ['provider'],
});

export async function listTrunks(
  params?: SipTrunkListParams,
): Promise<{ items: SipTrunkDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: SipTrunkDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createTrunk(
  input: SipTrunkCreateInput,
): Promise<{ id: string; entity: SipTrunkDoc }> {
  return (await resource.create(input)) as unknown as { id: string; entity: SipTrunkDoc };
}

export async function updateTrunk(
  id: string,
  patch: SipTrunkUpdateInput,
): Promise<SipTrunkDoc | null> {
  return (await resource.update(id, patch)) as unknown as SipTrunkDoc | null;
}

export async function deleteTrunk(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
