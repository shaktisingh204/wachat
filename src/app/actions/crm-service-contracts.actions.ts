'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

export async function getServiceContractById(id: string): Promise<any | null> {
  const session = await getSession();
  if (!session?.user) return null;
  if (!ObjectId.isValid(id)) return null;

  try {
    const { db } = await connectToDatabase();
    const doc = await db.collection('crm_service_contracts').findOne({
      _id: new ObjectId(id),
      userId: new ObjectId(session.user._id as string),
    });
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc));
  } catch (e) {
    console.error('Failed to fetch service contract by id:', e);
    return null;
  }
}

export async function updateServiceContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const id = (formData.get('id') as string) || '';
  if (!id || !ObjectId.isValid(id)) {
    return { error: 'Invalid contract ID.' };
  }

  try {
    const { db } = await connectToDatabase();

    const contractNo = ((formData.get('contractNo') as string | null) || '').trim();
    const customerName = (formData.get('customerName') as string) || '';
    const assetName = (formData.get('assetName') as string) || '';
    const coverage = (formData.get('coverage') as string) || '';
    const frequency = (formData.get('frequency') as string) || '';
    const periodStart = (formData.get('periodStart') as string | null) || '';
    const periodEnd = (formData.get('periodEnd') as string | null) || '';
    const billingAmount = parseFloat((formData.get('billingAmount') as string) || '0');
    const technician = (formData.get('technician') as string) || '';
    const notes = (formData.get('notes') as string) || '';
    const status = (formData.get('status') as string) || 'active';

    if (!contractNo) {
      return { error: 'Contract number is required.' };
    }

    const setDoc: Record<string, any> = {
      contractNo,
      customerName,
      assetName,
      coverage,
      frequency,
      billingAmount,
      technician,
      status,
      notes,
      updatedAt: new Date(),
    };
    if (periodStart) setDoc.periodStart = new Date(periodStart);
    if (periodEnd) setDoc.periodEnd = new Date(periodEnd);

    const result = await db.collection('crm_service_contracts').updateOne(
      {
        _id: new ObjectId(id),
        userId: new ObjectId(session.user._id as string),
      },
      { $set: setDoc },
    );

    if (result.matchedCount === 0) {
      return { error: 'Service contract not found or permission denied.' };
    }

    revalidatePath('/dashboard/crm/service-contracts');
    revalidatePath(`/dashboard/crm/service-contracts/${id}`);
    return { message: 'Service contract updated.', id };
  } catch (e: any) {
    console.error('updateServiceContract error:', e);
    return { error: e?.message || 'Failed to update service contract.' };
  }
}

export async function saveServiceContract(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const { db } = await connectToDatabase();

    const contractNoRaw = (formData.get('contractNo') as string | null) || '';
    const contractNo = contractNoRaw.trim() || `AMC-${Date.now().toString().slice(-6)}`;
    const customerName = (formData.get('customerName') as string) || '';
    const customerId = (formData.get('customerId') as string | null) || '';
    const assetName = (formData.get('assetName') as string) || '';
    const coverage = (formData.get('coverage') as string) || '';
    const frequency = (formData.get('frequency') as string) || '';
    const periodStart = (formData.get('periodStart') as string | null) || '';
    const periodEnd = (formData.get('periodEnd') as string | null) || '';
    const billingAmount = parseFloat((formData.get('billingAmount') as string) || '0');
    const technician = (formData.get('technician') as string) || '';
    const notes = (formData.get('notes') as string) || '';

    const doc: Record<string, any> = {
      userId: new ObjectId(session.user._id as string),
      contractNo,
      customerName,
      assetName,
      coverage,
      frequency,
      billingAmount,
      technician,
      status: 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (customerId && ObjectId.isValid(customerId)) {
      doc.customerId = new ObjectId(customerId);
    }
    if (periodStart) {
      doc.periodStart = new Date(periodStart);
    }
    if (periodEnd) {
      doc.periodEnd = new Date(periodEnd);
    }

    const { insertedId } = await db.collection('crm_service_contracts').insertOne(doc);

    revalidatePath('/dashboard/crm/service-contracts');
    return { message: 'Service contract created.', id: insertedId.toString() };
  } catch (e: any) {
    console.error('saveServiceContract error:', e);
    return { error: e?.message || 'Failed to save service contract.' };
  }
}
