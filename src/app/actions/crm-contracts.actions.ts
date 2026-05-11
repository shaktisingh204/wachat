'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function saveContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const title = (formData.get('title') as string | null)?.trim() || '';
  const partyName = (formData.get('partyName') as string | null)?.trim() || '';

  if (!title) return { error: 'Contract title is required.' };
  if (!partyName) return { error: 'Counter-party name is required.' };

  try {
    const { db } = await connectToDatabase();

    const type = (formData.get('type') as string | null) || 'nda';
    const partyEmail = (formData.get('partyEmail') as string | null)?.trim() || '';
    const effectiveDateRaw = (formData.get('effectiveDate') as string | null) || '';
    const expiryDateRaw = (formData.get('expiryDate') as string | null) || '';
    const autoRenew = formData.get('autoRenew') === 'on';
    const renewalNoticeDaysRaw = (formData.get('renewalNoticeDays') as string | null) || '';
    const valueRaw = (formData.get('value') as string | null) || '';
    const esignProvider = (formData.get('esignProvider') as string | null) || 'none';
    const notes = (formData.get('notes') as string | null)?.trim() || '';

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      title,
      type,
      partyName,
      autoRenew,
      esignProvider,
      status: 'draft',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (partyEmail) doc.partyEmail = partyEmail;
    if (effectiveDateRaw) doc.effectiveDate = new Date(effectiveDateRaw);
    if (expiryDateRaw) doc.expiryDate = new Date(expiryDateRaw);
    if (renewalNoticeDaysRaw) {
      const days = parseInt(renewalNoticeDaysRaw, 10);
      if (!isNaN(days)) doc.renewalNoticeDays = days;
    }
    if (valueRaw) {
      const val = parseFloat(valueRaw);
      if (!isNaN(val)) doc.value = val;
    }

    const { insertedId } = await db.collection('crm_contracts').insertOne(doc);

    revalidatePath('/dashboard/crm/sales/contracts');
    return { message: 'Contract saved successfully.', id: insertedId.toString() };
  } catch (e: any) {
    console.error('Failed to save CRM contract:', e);
    return { error: e?.message || 'Failed to save contract.' };
  }
}
