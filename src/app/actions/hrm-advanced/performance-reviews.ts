'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { PerformanceReview, PerformanceReviewSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_performance_reviews';

export async function getPerformanceReviews() {
  return await hrList<PerformanceReview>(COLLECTION);
}

export async function savePerformanceReview(payload: Partial<PerformanceReview>) {
  const parsed = PerformanceReviewSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/performance-reviews');
  return result;
}

export async function deletePerformanceReview(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/performance-reviews');
  return result;
}
