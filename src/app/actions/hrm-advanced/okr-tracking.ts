'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { OKR, OKRSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_okrs';

export async function getOKRs() {
  return await hrList<OKR>(COLLECTION);
}

export async function saveOKR(payload: Partial<OKR>) {
  const parsed = OKRSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/okr-tracking');
  return result;
}

export async function deleteOKR(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/okr-tracking');
  return result;
}
