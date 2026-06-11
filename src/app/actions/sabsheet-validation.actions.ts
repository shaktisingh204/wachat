'use server';

/**
 * SabSheet data validation — server actions. One document per workbook holds the rule list, scoped to
 * `ownerUserId = sessionUserId`. Rules are enforced client-side (list dropdowns in the cell editor).
 */
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { SABSHEET_VALIDATION_COLLECTION, type DataValidationRule } from '@/lib/sabsheet/validation/types';

async function requireUserOid(): Promise<ObjectId> {
  const session = await getSession();
  if (!session?.user?._id) throw new Error('SabSheet validation: not authenticated');
  return new ObjectId(session.user._id);
}

export async function getDataValidations(workbookId: string): Promise<DataValidationRule[]> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(SABSHEET_VALIDATION_COLLECTION)
    .findOne({ workbookId: new ObjectId(workbookId), ownerUserId: userId });
  return (doc?.rules as DataValidationRule[] | undefined) ?? [];
}

export async function saveDataValidations(workbookId: string, rules: DataValidationRule[]): Promise<{ ok: true }> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  await db.collection(SABSHEET_VALIDATION_COLLECTION).updateOne(
    { workbookId: new ObjectId(workbookId), ownerUserId: userId },
    { $set: { workbookId: new ObjectId(workbookId), ownerUserId: userId, rules, updatedAt: new Date() } },
    { upsert: true },
  );
  return { ok: true };
}
