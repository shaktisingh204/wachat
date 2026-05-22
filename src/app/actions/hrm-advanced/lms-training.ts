'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { TrainingCourse, TrainingCourseSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_training_courses';

export async function getTrainingCourses() {
  return await hrList<TrainingCourse>(COLLECTION);
}

export async function saveTrainingCourse(payload: Partial<TrainingCourse>) {
  const parsed = TrainingCourseSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/lms-training');
  return result;
}

export async function deleteTrainingCourse(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/lms-training');
  return result;
}
