'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { NativeAppAPIKey } from '@/types/platform';

const collectionName = 'platform_native_api_keys';

const keySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()),
});

export async function getNativeAppAPIKeys(): Promise<NativeAppAPIKey[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    name: doc.name,
    keyPrefix: doc.keyPrefix,
    scopes: doc.scopes || [],
    lastUsedAt: doc.lastUsedAt?.toISOString(),
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function createNativeAppAPIKey(data: any): Promise<{ key: string, record: NativeAppAPIKey }> {
  const parsed = keySchema.parse(data);
  const { db } = await connectToDatabase();
  const fullKey = `sk_${Math.random().toString(36).substr(2, 32)}`;
  const newDoc = {
    ...parsed,
    keyPrefix: fullKey.substring(0, 7),
    createdAt: new Date(),
  };
  const res = await db.collection(collectionName).insertOne(newDoc);
  return {
    key: fullKey,
    record: {
      id: res.insertedId.toString(),
      ...parsed,
      keyPrefix: newDoc.keyPrefix,
      createdAt: newDoc.createdAt.toISOString(),
    }
  };
}

export async function deleteNativeAppAPIKey(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
