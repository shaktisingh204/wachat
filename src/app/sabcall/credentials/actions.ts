'use server';

/**
 * SabCall SIP credentials — project-scoped CRUD (direct Mongo).
 * Tenanted by the active project id (`userId` field), consistent with the
 * engine (pjsip generation) + the rest of SabCall.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';
import type {
  SipCredentialDoc,
  SipCredentialListParams,
  SipCredentialCreateInput,
  SipCredentialUpdateInput,
} from '@/lib/rust-client/sabcall-credentials';

const resource = makeSabcallResource('sabcall_credentials', {
  searchFields: ['username', 'label'],
  revalidate: '/sabcall/credentials',
});

export async function listCredentials(
  params?: SipCredentialListParams,
): Promise<{ items: SipCredentialDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: SipCredentialDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createCredential(
  input: SipCredentialCreateInput,
): Promise<{ id: string; entity: SipCredentialDoc }> {
  return (await resource.create(input)) as unknown as { id: string; entity: SipCredentialDoc };
}

export async function updateCredential(
  id: string,
  patch: SipCredentialUpdateInput,
): Promise<SipCredentialDoc | null> {
  return (await resource.update(id, patch)) as unknown as SipCredentialDoc | null;
}

export async function deleteCredential(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
