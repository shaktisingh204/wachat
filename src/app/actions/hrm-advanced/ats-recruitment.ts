'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { ATSApplication, ATSApplicationSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_ats_applications';

export async function getATSApplications() {
  return await hrList<ATSApplication>(COLLECTION);
}

export async function saveATSApplication(payload: Partial<ATSApplication>) {
  const parsed = ATSApplicationSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/ats-recruitment');
  return result;
}

export async function deleteATSApplication(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/ats-recruitment');
  return result;
}
