'use server';

/**
 * SabSheet conditional formatting — server actions. One document per workbook holds the rule list,
 * scoped to `ownerUserId = sessionUserId`. Rules are evaluated client-side (see
 * `src/lib/sabsheet/cformat/apply.ts`).
 */
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { SABSHEET_CFORMAT_COLLECTION, type CFRule } from '@/lib/sabsheet/cformat/types';

async function requireUserOid(): Promise<ObjectId> {
  const session = await getSession();
  if (!session?.user?._id) throw new Error('SabSheet cformat: not authenticated');
  return new ObjectId(session.user._id);
}

/** All conditional-format rules for a workbook. */
export async function getConditionalFormats(workbookId: string): Promise<CFRule[]> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(SABSHEET_CFORMAT_COLLECTION)
    .findOne({ workbookId: new ObjectId(workbookId), ownerUserId: userId });
  return (doc?.rules as CFRule[] | undefined) ?? [];
}

/** Replace the full rule list for a workbook. */
export async function saveConditionalFormats(workbookId: string, rules: CFRule[]): Promise<{ ok: true }> {
  const userId = await requireUserOid();
  const { db } = await connectToDatabase();
  await db.collection(SABSHEET_CFORMAT_COLLECTION).updateOne(
    { workbookId: new ObjectId(workbookId), ownerUserId: userId },
    { $set: { workbookId: new ObjectId(workbookId), ownerUserId: userId, rules, updatedAt: new Date() } },
    { upsert: true },
  );
  return { ok: true };
}
