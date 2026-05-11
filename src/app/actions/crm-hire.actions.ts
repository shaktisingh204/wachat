'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function savePurchaseLead(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const title = (formData.get('title') as string | null)?.trim() || '';
  if (!title) return { error: 'Lead title is required.' };

  const category = (formData.get('category') as string | null)?.trim() || undefined;
  const vendorCandidate = (formData.get('vendorCandidate') as string | null)?.trim() || undefined;
  const requiredByRaw = (formData.get('requiredBy') as string | null)?.trim() || '';
  const qtyRaw = formData.get('quantity');
  const qty = qtyRaw ? parseFloat(qtyRaw as string) : undefined;
  const estimatedBudgetRaw = formData.get('estimatedBudget');
  const estimatedBudget = estimatedBudgetRaw
    ? parseFloat(estimatedBudgetRaw as string)
    : undefined;
  const specs = (formData.get('specs') as string | null)?.trim() || undefined;
  const owner = (formData.get('owner') as string | null)?.trim() || undefined;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_purchase_leads').insertOne({
      userId: new ObjectId(session.user._id as string),
      title,
      ...(category ? { category } : {}),
      ...(vendorCandidate ? { vendorCandidate } : {}),
      ...(requiredByRaw ? { requiredBy: new Date(requiredByRaw) } : {}),
      ...(qty !== undefined && !isNaN(qty) ? { quantity: qty } : {}),
      ...(estimatedBudget !== undefined && !isNaN(estimatedBudget) ? { estimatedBudget } : {}),
      ...(specs ? { specs } : {}),
      ...(owner ? { owner } : {}),
      stage: 'sourcing',
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/crm/purchases/hire');
    return { message: 'Hire request created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to create hire request: ${msg}` };
  }
}
