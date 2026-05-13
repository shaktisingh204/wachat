'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

export interface CrmBomComponent {
  itemName: string;
  qty: number;
  unit: string;
  scrapPct: number;
}

export interface CrmBomDoc {
  _id: ObjectId | string;
  userId: ObjectId | string;
  bomNo: string;
  finishedGoodName: string;
  finishedGoodId?: ObjectId | string;
  outputQty: number;
  unit: string;
  effectiveDate: Date | string;
  version: string;
  notes?: string;
  status?: string;
  components: CrmBomComponent[];
  createdAt: Date | string;
  updatedAt: Date | string;
}

export async function getCrmBomById(
  bomId: string,
): Promise<WithId<CrmBomDoc> | null> {
  if (!bomId || !ObjectId.isValid(bomId)) return null;

  const session = await getSession();
  if (!session?.user) return null;

  try {
    const { db } = await connectToDatabase();
    const bom = await db.collection<CrmBomDoc>('crm_boms').findOne({
      _id: new ObjectId(bomId),
      userId: new ObjectId(session.user._id),
    } as any);
    return bom ? JSON.parse(JSON.stringify(bom)) : null;
  } catch (e) {
    console.error('Failed to fetch CRM BOM:', e);
    return null;
  }
}

export async function getCrmBoms(): Promise<WithId<CrmBomDoc>[]> {
  const session = await getSession();
  if (!session?.user) return [];

  try {
    const { db } = await connectToDatabase();
    const docs = await db
      .collection<CrmBomDoc>('crm_boms')
      .find({ userId: new ObjectId(session.user._id) } as any)
      .sort({ createdAt: -1 })
      .toArray();
    return JSON.parse(JSON.stringify(docs));
  } catch (e) {
    console.error('Failed to fetch CRM BOMs:', e);
    return [];
  }
}

export async function saveBom(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Access denied.' };

  try {
    const bomId = (formData.get('bomId') as string | null)?.trim() || '';
    const isEditing = !!bomId && ObjectId.isValid(bomId);

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

    let parsedComponents: CrmBomComponent[] = [];
    try {
      parsedComponents = JSON.parse(componentsRaw);
    } catch {
      parsedComponents = [];
    }

    const bomNo = bomNoRaw || `BOM-${Date.now().toString().slice(-6)}`;

    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(session.user._id as string);

    if (isEditing) {
      const update = {
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
        notes,
        updatedAt: new Date(),
      };
      await db.collection('crm_boms').updateOne(
        { _id: new ObjectId(bomId), userId: userObjectId },
        { $set: update },
      );
      revalidatePath('/dashboard/crm/inventory/bom');
      revalidatePath(`/dashboard/crm/inventory/bom/${bomId}`);
      return { message: 'BOM updated.', id: bomId };
    }

    const result = await db.collection('crm_boms').insertOne({
      userId: userObjectId,
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
    return { error: `Failed to save BOM: ${msg}` };
  }
}
