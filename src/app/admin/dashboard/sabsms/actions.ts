'use server'

import { connectToDatabase } from '@/lib/mongodb';
import { SABSMS_COLLECTIONS } from '@/lib/sabsms/db/collections';
import { getAdminSession } from '@/lib/admin-session';
import { revalidatePath } from 'next/cache';

export async function retryFailedMessages() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) throw new Error("Unauthorized");
  
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  
  const res = await col.updateMany(
    { status: 'failed' },
    { $set: { status: 'queued', updatedAt: new Date(), queuedAt: new Date() } }
  );
  
  revalidatePath('/admin/dashboard/sabsms');
  return { success: true, count: res.modifiedCount };
}

export async function cancelQueuedMessages() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) throw new Error("Unauthorized");
  
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  
  const res = await col.updateMany(
    { status: 'queued' },
    { $set: { status: 'failed', errorMessage: 'Cancelled by admin', updatedAt: new Date(), failedAt: new Date() } }
  );
  
  revalidatePath('/admin/dashboard/sabsms');
  return { success: true, count: res.modifiedCount };
}
