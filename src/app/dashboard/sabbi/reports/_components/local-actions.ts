'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession } from '@/lib/hr-crud';
import { ObjectId } from 'mongodb';

export async function bulkEscalatePriority(taskIds: string[]) {
  const user = await requireSession();
  if (!user) throw new Error('Unauthorized');
  const { db } = await connectToDatabase();
  const ids = taskIds.map(id => new ObjectId(id));
  
  await db.collection('crm_tasks').updateMany(
    { _id: { $in: ids }, userId: new ObjectId(user._id), priority: { $ne: 'High' } },
    { $set: { priority: 'High', updatedAt: new Date() } }
  );
  return { success: true };
}

export async function bulkReassignTasks(taskIds: string[], assigneeId: string) {
  const user = await requireSession();
  if (!user) throw new Error('Unauthorized');
  const { db } = await connectToDatabase();
  const ids = taskIds.map(id => new ObjectId(id));
  
  await db.collection('crm_tasks').updateMany(
    { _id: { $in: ids }, userId: new ObjectId(user._id) },
    { $set: { assignedTo: new ObjectId(assigneeId), updatedAt: new Date() } }
  );
  return { success: true };
}
