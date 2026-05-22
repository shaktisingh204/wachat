'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { OnboardingTask, OnboardingTaskSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_onboarding_tasks';

export async function getOnboardingTasks() {
  return await hrList<OnboardingTask>(COLLECTION);
}

export async function saveOnboardingTask(payload: Partial<OnboardingTask>) {
  const parsed = OnboardingTaskSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/employee-onboarding');
  return result;
}

export async function deleteOnboardingTask(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/employee-onboarding');
  return result;
}
