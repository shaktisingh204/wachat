'use server';

/**
 * SabCall business hours — project-scoped CRUD (direct Mongo).
 *
 * Tenanted by the active SabCall project id (stored in the `userId` field),
 * consistent with `sabcall.actions.ts` and exactly what `sabcall-engine` reads
 * when deciding open/closed routing. Direct Mongo (not the Rust crate) is the
 * primary path because the crate's `user_oid` scope keys off the JWT subject
 * (the session user), which would not isolate per project.
 */

import { makeSabcallResource, type ResourceListParams } from '@/lib/sabcall/resource-crud';

export interface BusinessHoursDoc {
  _id: string;
  userId?: string;
  name: string;
  timezone: string;
  rules: { day: string; open: string; close: string }[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

const resource = makeSabcallResource('sabcall_business_hours', {
  searchFields: ['name'],
  revalidate: '/sabcall/business-hours',
});

export async function listBusinessHours(
  params?: ResourceListParams,
): Promise<{ items: BusinessHoursDoc[]; page: number; limit: number; hasMore: boolean }> {
  return (await resource.list(params)) as unknown as {
    items: BusinessHoursDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export async function createBusinessHours(
  input: Partial<BusinessHoursDoc>,
): Promise<{ id: string; entity: BusinessHoursDoc }> {
  return (await resource.create(input as Record<string, unknown>)) as unknown as {
    id: string;
    entity: BusinessHoursDoc;
  };
}

export async function updateBusinessHours(
  id: string,
  patch: Partial<BusinessHoursDoc>,
): Promise<BusinessHoursDoc | null> {
  return (await resource.update(id, patch as Record<string, unknown>)) as unknown as BusinessHoursDoc | null;
}

export async function deleteBusinessHours(id: string): Promise<{ deleted: boolean }> {
  return resource.remove(id);
}
