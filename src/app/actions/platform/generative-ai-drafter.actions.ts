'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { GenerativeAIDraft } from '@/types/platform';

const collectionName = 'platform_generative_ai_drafts';

const draftSchema = z.object({
  entityType: z.enum(['email', 'proposal', 'contract']),
  prompt: z.string().min(1),
  content: z.string().min(1),
  status: z.enum(['draft', 'approved', 'rejected']),
});

export async function getGenerativeAIDrafts(): Promise<GenerativeAIDraft[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    entityType: doc.entityType,
    prompt: doc.prompt,
    content: doc.content,
    status: doc.status,
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function createGenerativeAIDraft(data: any): Promise<GenerativeAIDraft> {
  const parsed = draftSchema.parse(data);
  const { db } = await connectToDatabase();
  const newDoc = {
    ...parsed,
    createdAt: new Date(),
  };
  const res = await db.collection(collectionName).insertOne(newDoc);
  return {
    id: res.insertedId.toString(),
    ...parsed,
    createdAt: newDoc.createdAt.toISOString(),
  };
}

export async function updateGenerativeAIDraftStatus(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).updateOne(
    { _id: new ObjectId(id) },
    { $set: { status, updatedAt: new Date() } }
  );
  return res.modifiedCount === 1;
}

export async function deleteGenerativeAIDraft(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
