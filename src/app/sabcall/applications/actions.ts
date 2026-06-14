'use server';

/**
 * SabCall voice applications — project-scoped CRUD (direct Mongo).
 * Tenanted by the active project id (`userId` field), exactly what the engine
 * reads when routing a call to its application. The `type` field persists under
 * the BSON key `type`.
 */

import { makeSabcallResource } from '@/lib/sabcall/resource-crud';
import type {
  VoiceApplicationDoc,
  VoiceApplicationListParams,
  VoiceApplicationCreateInput,
  VoiceApplicationUpdateInput,
} from '@/lib/rust-client/sabcall-applications';

const resource = makeSabcallResource('sabcall_applications', {
  searchFields: ['name'],
  revalidate: '/sabcall/applications',
  extraFilters: ['type'],
});

export async function listApplications(
  params?: VoiceApplicationListParams,
): Promise<{ items: VoiceApplicationDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: VoiceApplicationDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createApplication(
  input: VoiceApplicationCreateInput,
): Promise<{ id: string; entity: VoiceApplicationDoc }> {
  return (await resource.create(input)) as unknown as {
    id: string;
    entity: VoiceApplicationDoc;
  };
}

export async function updateApplication(
  id: string,
  patch: VoiceApplicationUpdateInput,
): Promise<VoiceApplicationDoc | null> {
  return (await resource.update(id, patch)) as unknown as VoiceApplicationDoc | null;
}

export async function deleteApplication(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
