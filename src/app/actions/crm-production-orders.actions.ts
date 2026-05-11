'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function saveProductionOrder(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const orderNoRaw = (formData.get('orderNo') as string | null)?.trim() || '';
    const finishedGoodName = (formData.get('finishedGoodName') as string | null)?.trim() || '';
    if (!finishedGoodName) return { error: 'Finished Good Name is required.' };

    const bomRef = (formData.get('bomRef') as string | null)?.trim() || '';
    const plannedQtyRaw = formData.get('plannedQty');
    const plannedQty = plannedQtyRaw ? parseFloat(plannedQtyRaw as string) : NaN;
    if (isNaN(plannedQty) || plannedQty <= 0) return { error: 'Planned Qty is required.' };

    const unit = (formData.get('unit') as string | null)?.trim() || '';
    const plannedStartRaw = (formData.get('plannedStart') as string | null)?.trim() || '';
    const plannedEndRaw = (formData.get('plannedEnd') as string | null)?.trim() || '';
    const machineId = (formData.get('machineId') as string | null)?.trim() || '';
    const machineOperator = (formData.get('machineOperator') as string | null)?.trim() || '';
    const notes = (formData.get('notes') as string | null)?.trim() || '';

    const orderNo = orderNoRaw || `PO-${Date.now().toString().slice(-6)}`;

    const { db } = await connectToDatabase();
    const result = await db.collection('crm_production_orders').insertOne({
      userId: new ObjectId(session.user._id as string),
      orderNo,
      bomRef: bomRef || undefined,
      finishedGoodName,
      plannedQty,
      actualYield: 0,
      unit,
      plannedStart: plannedStartRaw ? new Date(plannedStartRaw) : undefined,
      plannedEnd: plannedEndRaw ? new Date(plannedEndRaw) : undefined,
      machineId: machineId || undefined,
      machineOperator: machineOperator || undefined,
      notes: notes || undefined,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/crm/inventory/production-orders');
    return { message: 'Production order created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('saveProductionOrder error:', msg);
    return { error: `Failed to create production order: ${msg}` };
  }
}
