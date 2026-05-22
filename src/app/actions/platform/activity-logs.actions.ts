'use server';

import { connectToDatabase } from '@/lib/mongodb';
import type { ActivityLog } from '@/types/platform';

const collectionName = 'platform_activity_logs';

export async function getActivityLogs(): Promise<ActivityLog[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ timestamp: -1 }).limit(100).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    userId: doc.userId,
    action: doc.action,
    entityType: doc.entityType,
    entityId: doc.entityId,
    metadata: doc.metadata || {},
    timestamp: doc.timestamp?.toISOString() || new Date().toISOString(),
    ipAddress: doc.ipAddress || '',
  }));
}
