'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { RedactionPolicy } from '@/types/platform';

const collectionName = 'platform_redaction_policies';

const policySchema = z.object({
  name: z.string().min(1),
  targetFields: z.array(z.string()),
  maskPattern: z.string(),
  status: z.enum(['active', 'inactive']),
});

export async function getRedactionPolicies(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  targetField?: string;
} = {}): Promise<{ data: RedactionPolicy[]; total: number; page: number; totalPages: number }> {
  const { db } = await connectToDatabase();
  const { page = 1, limit = 10, search, status, targetField } = params;

  const query: any = {};
  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }
  if (status && status !== 'all') {
    query.status = status;
  }
  if (targetField) {
    query.targetFields = { $regex: targetField, $options: 'i' };
  }

  const skip = (page - 1) * limit;
  
  const [docs, total] = await Promise.all([
    db.collection(collectionName).find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection(collectionName).countDocuments(query)
  ]);

  return {
    data: docs.map(doc => ({
      id: doc._id.toString(),
      name: doc.name,
      targetFields: doc.targetFields || [],
      maskPattern: doc.maskPattern,
      status: doc.status || 'active',
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

export async function createRedactionPolicy(data: any): Promise<RedactionPolicy> {
  const parsed = policySchema.parse(data);
  const { db } = await connectToDatabase();
  const newDoc = {
    ...parsed,
    createdAt: new Date(),
  };
  const res = await db.collection(collectionName).insertOne(newDoc);
  return {
    id: res.insertedId.toString(),
    ...parsed,
  };
}

export async function deleteRedactionPolicy(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
