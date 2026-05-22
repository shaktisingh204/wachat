'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { OffboardingTask, OffboardingTaskSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_offboarding_tasks';

export async function getOffboardingTasks() {
  return await hrList<OffboardingTask>(COLLECTION);
}

export async function saveOffboardingTask(payload: Partial<OffboardingTask>) {
  const parsed = OffboardingTaskSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/offboarding');
  return result;
}

export async function deleteOffboardingTask(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/offboarding');
  return result;
}
