'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { BenefitPlan, BenefitPlanSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_benefit_plans';

export async function getBenefitPlans() {
  return await hrList<BenefitPlan>(COLLECTION);
}

export async function saveBenefitPlan(payload: Partial<BenefitPlan>) {
  const parsed = BenefitPlanSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/benefits-portal');
  return result;
}

export async function deleteBenefitPlan(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/benefits-portal');
  return result;
}
