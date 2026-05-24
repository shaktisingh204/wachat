'use server';

import { connectToDatabase } from '@/lib/mongodb';
import type { ActivityLog } from '@/types/platform';

const collectionName = 'platform_activity_logs';

export interface GetActivityLogsParams {
  page?: number;
  pageSize?: number;
  query?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
}

export async function getActivityLogs(params?: GetActivityLogsParams): Promise<{ data: ActivityLog[], total: number }> {
  const { db } = await connectToDatabase();
  
  const page = params?.page || 1;
  const pageSize = params?.pageSize || 20;
  const query = params?.query || '';
  const startDate = params?.startDate;
  const endDate = params?.endDate;
  const userId = params?.userId;

  const filter: any = {};
  
  if (query) {
    filter.$or = [
      { action: { $regex: query, $options: 'i' } },
      { entityType: { $regex: query, $options: 'i' } }
    ];
  }

  if (userId) {
    filter.userId = userId;
  }

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) {
      filter.timestamp.$gte = new Date(startDate);
    }
    if (endDate) {
      // Set to end of the day for inclusive filtering
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.timestamp.$lte = end;
    }
  }

  const skip = (page - 1) * pageSize;

  const [docs, total] = await Promise.all([
    db.collection(collectionName).find(filter).sort({ timestamp: -1 }).skip(skip).limit(pageSize).toArray(),
    db.collection(collectionName).countDocuments(filter)
  ]);

  return {
    data: docs.map(doc => ({
      id: doc._id.toString(),
      userId: doc.userId,
      action: doc.action,
      entityType: doc.entityType,
      entityId: doc.entityId,
      metadata: doc.metadata || {},
      timestamp: doc.timestamp?.toISOString() || new Date().toISOString(),
      ipAddress: doc.ipAddress || '',
    })),
    total
  };
}
