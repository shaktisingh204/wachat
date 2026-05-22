'use server';

import { hrList, hrSave, hrDelete } from '@/lib/hr-crud';
import { ExpenseClaim, ExpenseClaimSchema } from '@/lib/hrm-advanced-types';
import { revalidatePath } from 'next/cache';

const COLLECTION = 'hrm_expense_claims';

export async function getExpenseClaims() {
  return await hrList<ExpenseClaim>(COLLECTION);
}

export async function saveExpenseClaim(payload: Partial<ExpenseClaim>) {
  const parsed = ExpenseClaimSchema.parse(payload);
  const result = await hrSave(COLLECTION, parsed);
  if (result.error) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/expense-policy');
  return result;
}

export async function deleteExpenseClaim(id: string) {
  const result = await hrDelete(COLLECTION, id);
  if (!result.success) throw new Error(result.error);
  revalidatePath('/dashboard/hrm-advanced/expense-policy');
  return result;
}
