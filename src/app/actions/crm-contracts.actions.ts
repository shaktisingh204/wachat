'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function getContractById(
  contractId: string,
): Promise<WithId<Record<string, unknown>> | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(contractId)) return null;

  try {
    const { db } = await connectToDatabase();
    const contract = await db.collection('crm_contracts').findOne({
      _id: new ObjectId(contractId),
      userId: new ObjectId(session.user._id as string),
    });
    if (!contract) return null;
    return JSON.parse(JSON.stringify(contract));
  } catch (e) {
    console.error('Failed to fetch contract by id:', e);
    return null;
  }
}

export async function updateContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const contractId = (formData.get('contractId') as string | null) || '';
  if (!contractId || !ObjectId.isValid(contractId)) {
    return { error: 'Invalid contract id.' };
  }

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
    const status = (formData.get('status') as string | null) || undefined;

    const $set: Record<string, any> = {
      title,
      type,
      partyName,
      autoRenew,
      esignProvider,
      notes,
      updatedAt: new Date(),
    };
    if (partyEmail) $set.partyEmail = partyEmail;
    if (effectiveDateRaw) $set.effectiveDate = new Date(effectiveDateRaw);
    if (expiryDateRaw) $set.expiryDate = new Date(expiryDateRaw);
    if (renewalNoticeDaysRaw) {
      const days = parseInt(renewalNoticeDaysRaw, 10);
      if (!isNaN(days)) $set.renewalNoticeDays = days;
    }
    if (valueRaw) {
      const val = parseFloat(valueRaw);
      if (!isNaN(val)) $set.value = val;
    }
    if (status) $set.status = status;

    const result = await db.collection('crm_contracts').updateOne(
      {
        _id: new ObjectId(contractId),
        userId: new ObjectId(session.user._id as string),
      },
      { $set },
    );

    if (result.matchedCount === 0) {
      return { error: 'Contract not found.' };
    }

    revalidatePath('/dashboard/crm/sales/contracts');
    revalidatePath(`/dashboard/crm/sales/contracts/${contractId}`);
    return { message: 'Contract updated successfully.', id: contractId };
  } catch (e: any) {
    console.error('updateContract error:', e);
    return { error: e?.message || 'Failed to update contract.' };
  }
}

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
