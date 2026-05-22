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

export async function getRedactionPolicies(): Promise<RedactionPolicy[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    name: doc.name,
    targetFields: doc.targetFields || [],
    maskPattern: doc.maskPattern,
    status: doc.status || 'active',
  }));
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
