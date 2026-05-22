'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { CustomObjectDefinition } from '@/types/platform';

const collectionName = 'platform_custom_objects';

const objectSchema = z.object({
  singularName: z.string().min(1),
  pluralName: z.string().min(1),
  apiIdentifier: z.string().min(1),
  fields: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'date', 'reference']),
    required: z.boolean(),
  })),
});

export async function getCustomObjects(): Promise<CustomObjectDefinition[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    singularName: doc.singularName,
    pluralName: doc.pluralName,
    apiIdentifier: doc.apiIdentifier,
    fields: doc.fields || [],
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function createCustomObject(data: any): Promise<CustomObjectDefinition> {
  const parsed = objectSchema.parse(data);
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

export async function deleteCustomObject(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
