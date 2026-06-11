'use server';

/**
 * SabSheet sharing — invite collaborators by email. Shared users get edit access (their id is added to
 * `sabsheet_workbooks.sharedWithUserIds`, which both the TS actions and the Rust op endpoint already
 * honor). Only the workbook owner can change sharing.
 */
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

const COLL_WORKBOOKS = 'sabsheet_workbooks';

async function requireUserOid(): Promise<ObjectId> {
  const session = await getSession();
  if (!session?.user?._id) throw new Error('SabSheet share: not authenticated');
  return new ObjectId(session.user._id);
}

async function assertOwner(workbookId: ObjectId, userId: ObjectId) {
  const { db } = await connectToDatabase();
  const wb = await db.collection(COLL_WORKBOOKS).findOne({ _id: workbookId, ownerUserId: userId });
  if (!wb) throw new Error('Only the owner can change sharing.');
}

export interface WorkbookMember {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'editor';
}

/** Owner + shared editors of a workbook (with names/emails). Accessible to any member. */
export async function listWorkbookMembers(workbookId: string): Promise<WorkbookMember[]> {
  const userId = await requireUserOid();
  const wbId = new ObjectId(workbookId);
  const { db } = await connectToDatabase();
  const wb = await db.collection(COLL_WORKBOOKS).findOne({
    _id: wbId,
    $or: [{ ownerUserId: userId }, { sharedWithUserIds: userId }],
  });
  if (!wb) throw new Error('workbook not found');

  const ownerId: ObjectId = wb.ownerUserId;
  const sharedIds: ObjectId[] = (wb.sharedWithUserIds ?? []) as ObjectId[];
  const allIds = [ownerId, ...sharedIds];
  const users = await db
    .collection('users')
    .find({ _id: { $in: allIds } })
    .project({ name: 1, email: 1 })
    .toArray();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const member = (id: ObjectId, role: 'owner' | 'editor'): WorkbookMember => {
    const u = byId.get(String(id));
    return { userId: String(id), name: u?.name || u?.email || 'User', email: u?.email || '', role };
  };
  return [member(ownerId, 'owner'), ...sharedIds.map((id) => member(id, 'editor'))];
}

/** Invite a user (by email) as an editor. Owner only. */
export async function shareWorkbook(workbookId: string, email: string): Promise<{ ok: true } | { error: string }> {
  const userId = await requireUserOid();
  const wbId = new ObjectId(workbookId);
  await assertOwner(wbId, userId);
  const { db } = await connectToDatabase();
  const target = await db.collection('users').findOne({ email: email.trim().toLowerCase() });
  if (!target) return { error: 'No user with that email.' };
  if (String(target._id) === String(userId)) return { error: 'You already own this workbook.' };
  await db
    .collection(COLL_WORKBOOKS)
    .updateOne({ _id: wbId }, { $addToSet: { sharedWithUserIds: target._id } });
  return { ok: true };
}

/** Remove a shared editor. Owner only. */
export async function unshareWorkbook(workbookId: string, memberUserId: string): Promise<{ ok: true }> {
  const userId = await requireUserOid();
  const wbId = new ObjectId(workbookId);
  await assertOwner(wbId, userId);
  const { db } = await connectToDatabase();
  await db
    .collection(COLL_WORKBOOKS)
    .updateOne({ _id: wbId }, { $pull: { sharedWithUserIds: new ObjectId(memberUserId) } as never });
  return { ok: true };
}
