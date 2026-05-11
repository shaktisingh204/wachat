'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

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
