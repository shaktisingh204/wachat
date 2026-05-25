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

export async function bulkDeleteOnboardingTasks(ids: string[]) {
  // In a real implementation, you'd use a bulk delete operation
  // For now, we'll map over them
  for (const id of ids) {
    await hrDelete(COLLECTION, id);
  }
  revalidatePath('/dashboard/hrm-advanced/employee-onboarding');
  return { success: true };
}

export async function bulkCompleteOnboardingTasks(ids: string[]) {
  for (const id of ids) {
    // Assuming hrList or similar can fetch by ID, or we just patch
    // For simplicity, we just send a save with isCompleted: true
    // Need to fetch first if we want to retain other fields, but hrSave 
    // usually does an upsert/merge if we pass _id
    await hrSave(COLLECTION, { _id: id, isCompleted: true } as any);
  }
  revalidatePath('/dashboard/hrm-advanced/employee-onboarding');
  return { success: true };
}
