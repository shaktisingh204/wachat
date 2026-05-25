'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { GenerativeAIDraft } from '@/types/platform';

const collectionName = 'platform_generative_ai_drafts';

const draftSchema = z.object({
  entityType: z.enum(['email', 'proposal', 'contract']),
  aiModel: z.enum(['gpt-4', 'claude']),
  prompt: z.string().min(1),
  content: z.string().min(1),
  status: z.enum(['draft', 'approved', 'rejected']),
});

export async function getGenerativeAIDrafts(page: number = 1, limit: number = 10): Promise<{ drafts: GenerativeAIDraft[], total: number }> {
  const { db } = await connectToDatabase();
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    db.collection(collectionName).find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    db.collection(collectionName).countDocuments()
  ]);
  
  return {
    drafts: docs.map(doc => ({
      id: doc._id.toString(),
      entityType: doc.entityType,
      aiModel: doc.aiModel || 'gpt-4',
      prompt: doc.prompt,
      content: doc.content,
      status: doc.status,
      createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    })),
    total
  };
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
