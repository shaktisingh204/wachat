'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { WebhookEndpoint } from '@/types/platform';

const collectionName = 'platform_webhooks';

const webhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()),
});

export async function getWebhooks(): Promise<WebhookEndpoint[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    name: doc.name,
    url: doc.url,
    events: doc.events || [],
    status: doc.status || 'active',
    secret: doc.secret || '',
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function createWebhook(data: any): Promise<WebhookEndpoint> {
  const parsed = webhookSchema.parse(data);
  const { db } = await connectToDatabase();
  const newDoc = {
    ...parsed,
    status: 'active',
    secret: `whsec_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date(),
  };
  const res = await db.collection(collectionName).insertOne(newDoc);
  return {
    id: res.insertedId.toString(),
    ...parsed,
    status: newDoc.status as any,
    secret: newDoc.secret,
    createdAt: newDoc.createdAt.toISOString(),
  };
}

export async function deleteWebhook(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
