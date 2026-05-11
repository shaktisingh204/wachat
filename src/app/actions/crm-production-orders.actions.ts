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

export async function getProductionOrderById(
  orderId: string,
): Promise<Record<string, any> | null> {
  if (!ObjectId.isValid(orderId)) return null;
  const session = await getSession();
  if (!session?.user?._id) return null;
  const { db } = await connectToDatabase();
  const doc = await db.collection('crm_production_orders').findOne({
    _id: new ObjectId(orderId),
    userId: new ObjectId(session.user._id as string),
  } as any);
  return doc ? JSON.parse(JSON.stringify(doc)) : null;
}

export async function updateProductionOrderYield(
  _prev: any,
  formData: FormData,
): Promise<{ message?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  const orderId = (formData.get('orderId') as string | null)?.trim() || '';
  if (!ObjectId.isValid(orderId)) return { error: 'Invalid order ID.' };

  const actualYieldRaw = formData.get('actualYield');
  const actualYield = actualYieldRaw ? parseFloat(actualYieldRaw as string) : NaN;
  if (isNaN(actualYield) || actualYield < 0) return { error: 'Valid actual yield is required.' };

  const status = (formData.get('status') as string | null) || undefined;
  const notes = (formData.get('notes') as string | null)?.trim() || undefined;

  try {
    const { db } = await connectToDatabase();
    const result = await db.collection('crm_production_orders').updateOne(
      {
        _id: new ObjectId(orderId),
        userId: new ObjectId(session.user._id as string),
      } as any,
      {
        $set: {
          actualYield,
          ...(status ? { status } : {}),
          ...(notes !== undefined ? { notes } : {}),
          updatedAt: new Date(),
        },
      },
    );
    if (result.matchedCount === 0) return { error: 'Order not found.' };
    revalidatePath(`/dashboard/crm/inventory/production-orders/${orderId}`);
    revalidatePath('/dashboard/crm/inventory/production-orders');
    return { message: 'Yield updated successfully.' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return { error: `Failed to update yield: ${msg}` };
  }
}
