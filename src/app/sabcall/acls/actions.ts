'use server';

/**
 * SabCall SIP ACLs — project-scoped CRUD (direct Mongo).
 * Tenanted by the active project id (`userId` field). `cidrs` is a string[] —
 * the page splits its textarea into an array before calling create/update.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';
import type {
  SipAclDoc,
  SipAclListParams,
  SipAclCreateInput,
  SipAclUpdateInput,
} from '@/lib/rust-client/sabcall-acls';

const resource = makeSabcallResource('sabcall_acls', {
  searchFields: ['name'],
  revalidate: '/sabcall/acls',
});

export async function listAcls(
  params?: SipAclListParams,
): Promise<{ items: SipAclDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: SipAclDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createAcl(
  input: SipAclCreateInput,
): Promise<{ id: string; entity: SipAclDoc }> {
  return (await resource.create(input)) as unknown as { id: string; entity: SipAclDoc };
}

export async function updateAcl(
  id: string,
  patch: SipAclUpdateInput,
): Promise<SipAclDoc | null> {
  return (await resource.update(id, patch)) as unknown as SipAclDoc | null;
}

export async function deleteAcl(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
