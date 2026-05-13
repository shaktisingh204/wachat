'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';

export async function getBudgets(): Promise<{ budgets: any[]; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { budgets: [], error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);
    const docs = await db
      .collection('crm_budgets')
      .find({ userId: userObjectId } as any)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return { budgets: JSON.parse(JSON.stringify(docs)) };
  } catch (e) {
    console.error('Failed to fetch crm_budgets:', e);
    return { budgets: [], error: getErrorMessage(e) };
  }
}

export async function getBudgetById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(id)) return null;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_budgets').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch budget by id:', e);
    return null;
  }
}

export async function updateBudget(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id = (formData.get('id') as string) || '';
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid budget ID.' };
  }

  try {
    const { db } = await connectToDatabase();

    const budgetHead = (formData.get('budgetHead') as string | null) || '';
    const period = (formData.get('period') as string | null) || '';
    const scenario = (formData.get('scenario') as string | null) || 'base';
    const planAmountRaw = formData.get('planAmount') as string | null;
    const planAmount = planAmountRaw ? parseFloat(planAmountRaw) : 0;
    const alertAtRaw = formData.get('alertAt') as string | null;
    const alertAt = alertAtRaw ? parseInt(alertAtRaw, 10) : 0;
    const ownerName = (formData.get('ownerName') as string | null) || '';
    const notes = (formData.get('notes') as string | null) || '';
    const status = (formData.get('status') as string | null) || 'draft';

    if (!budgetHead) return { error: 'Budget Head is required.' };

    const result = await db.collection('crm_budgets').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      {
        $set: {
          budgetHead,
          period,
          scenario,
          planAmount,
          alertAt,
          ownerName,
          notes,
          status,
          updatedAt: new Date(),
        },
      } as any,
    );

    if (result.matchedCount === 0) {
      return { error: 'Budget not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/budgets');
    revalidatePath(`/dashboard/crm/budgets/${id}`);
    return { message: 'Budget updated.', id };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function saveBudget(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);

    const budgetHead = (formData.get('budgetHead') as string | null) || '';
    const period = (formData.get('period') as string | null) || '';
    const scenario = (formData.get('scenario') as string | null) || 'base';
    const planAmountRaw = formData.get('planAmount') as string | null;
    const planAmount = planAmountRaw ? parseFloat(planAmountRaw) : 0;
    const alertAtRaw = formData.get('alertAt') as string | null;
    const alertAt = alertAtRaw ? parseInt(alertAtRaw, 10) : 0;
    const ownerName = (formData.get('ownerName') as string | null) || '';
    const notes = (formData.get('notes') as string | null) || '';

    if (!budgetHead) return { error: 'Budget Head is required.' };

    const result = await db.collection('crm_budgets').insertOne({
      userId: userObjectId,
      budgetHead,
      period,
      scenario,
      planAmount,
      actual: 0,
      variance: 0 - planAmount,
      alertAt,
      ownerName,
      notes,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    revalidatePath('/dashboard/crm/budgets');
    return { message: 'Budget saved.', id: result.insertedId.toString() };
  } catch (e) {
    return { error: getErrorMessage(e) };
  }
}

export async function deleteBudget(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid ID.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_budgets').deleteOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    } as any);

    if (result.deletedCount === 0) {
      return { success: false, error: 'Budget not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/budgets');
    return { success: true };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) };
  }
}
