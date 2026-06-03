'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { ObjectId } from 'mongodb';

export async function getLiveDashboardsData() {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized' };
  
  const { db } = await connectToDatabase();
  const data = await db.collection('sabdesk_live_dashboards').find({ userId: session.user._id }).sort({ _id: -1 }).toArray();
  return { success: true, data: data.map(d => ({ ...d, _id: d._id.toString() })) };
}

export async function getSocialInboxMessages() {
  const session = await getSession();
  if (!session?.user?._id) return { success: false, error: 'Unauthorized' };
  
  const { db } = await connectToDatabase();
  const data = await db.collection('sabdesk_social_inbox').find({ userId: session.user._id }).sort({ timestamp: -1 }).toArray();
  return { success: true, data: data.map(d => ({ ...d, _id: d._id.toString() })) };
}
