'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export async function saveBom(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const bomNoRaw = (formData.get('bomNo') as string | null)?.trim() || '';
    const finishedGoodName = (formData.get('finishedGoodName') as string | null)?.trim() || '';
    if (!finishedGoodName) return { error: 'Finished Good Name is required.' };

    const finishedGoodId = (formData.get('finishedGoodId') as string | null)?.trim() || '';
    const outputQtyRaw = formData.get('outputQty');
    const outputQty = outputQtyRaw ? parseFloat(outputQtyRaw as string) : 1;
    const unit = (formData.get('unit') as string | null)?.trim() || '';
    const effectiveDateRaw = (formData.get('effectiveDate') as string | null)?.trim() || '';
    const version = (formData.get('version') as string | null)?.trim() || '1.0';
    const notes = (formData.get('notes') as string | null)?.trim() || '';
    const componentsRaw = (formData.get('components') as string | null) || '[]';

    let parsedComponents: { itemName: string; qty: number; unit: string; scrapPct: number }[] = [];
    try {
      parsedComponents = JSON.parse(componentsRaw);
    } catch {
      parsedComponents = [];
    }

    const bomNo = bomNoRaw || `BOM-${Date.now().toString().slice(-6)}`;

    const { db } = await connectToDatabase();
    const result = await db.collection('crm_boms').insertOne({
      userId: new ObjectId(session.user._id as string),
      bomNo,
      finishedGoodName,
      finishedGoodId:
        finishedGoodId && ObjectId.isValid(finishedGoodId)
          ? new ObjectId(finishedGoodId)
          : undefined,
      outputQty: isNaN(outputQty) ? 1 : outputQty,
      unit,
      effectiveDate: effectiveDateRaw ? new Date(effectiveDateRaw) : new Date(),
      version,
      components: parsedComponents,
      status: 'active',
      notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath('/dashboard/crm/inventory/bom');
    return { message: 'BOM created.', id: result.insertedId.toString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('saveBom error:', msg);
    return { error: `Failed to create BOM: ${msg}` };
  }
}
