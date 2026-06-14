'use server';

/**
 * SabCall SIP domains — project-scoped CRUD (direct Mongo).
 * Tenanted by the active project id (`userId` field), consistent with the
 * engine + the rest of SabCall.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';
import type {
  SipDomainDoc,
  SipDomainListParams,
  SipDomainCreateInput,
  SipDomainUpdateInput,
} from '@/lib/rust-client/sabcall-domains';

const resource = makeSabcallResource('sabcall_domains', {
  searchFields: ['domain', 'label'],
  revalidate: '/sabcall/domains',
});

export async function listDomains(
  params?: SipDomainListParams,
): Promise<{ items: SipDomainDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: SipDomainDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createDomain(
  input: SipDomainCreateInput,
): Promise<{ id: string; entity: SipDomainDoc }> {
  return (await resource.create(input)) as unknown as { id: string; entity: SipDomainDoc };
}

export async function updateDomain(
  id: string,
  patch: SipDomainUpdateInput,
): Promise<SipDomainDoc | null> {
  return (await resource.update(id, patch)) as unknown as SipDomainDoc | null;
}

export async function deleteDomain(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
