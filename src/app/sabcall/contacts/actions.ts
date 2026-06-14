'use server';

/**
 * SabCall contacts — project-scoped CRUD (direct Mongo).
 * Tenanted by the active project id (`userId` field). Used by the contacts
 * page and the voice-broadcast feature.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';
import type {
  VoiceContactDoc,
  VoiceContactListParams,
  VoiceContactCreateInput,
  VoiceContactUpdateInput,
} from '@/lib/rust-client/sabcall-contacts';

const resource = makeSabcallResource('sabcall_contacts', {
  searchFields: ['name', 'phone', 'email', 'company'],
  revalidate: '/sabcall/contacts',
  extraFilters: ['vip'],
});

export async function listContacts(
  params?: VoiceContactListParams,
): Promise<{ items: VoiceContactDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: VoiceContactDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createContact(
  input: VoiceContactCreateInput,
): Promise<{ id: string; entity: VoiceContactDoc }> {
  return (await resource.create(input)) as unknown as { id: string; entity: VoiceContactDoc };
}

export async function updateContact(
  id: string,
  patch: VoiceContactUpdateInput,
): Promise<VoiceContactDoc | null> {
  return (await resource.update(id, patch)) as unknown as VoiceContactDoc | null;
}

export async function deleteContact(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
