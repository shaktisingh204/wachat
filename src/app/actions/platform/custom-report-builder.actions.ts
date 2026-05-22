'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { CustomReport } from '@/types/platform';

const collectionName = 'platform_custom_reports';

const reportSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  dataSource: z.string(),
  columns: z.array(z.string()),
});

export async function getCustomReports(): Promise<CustomReport[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    dataSource: doc.dataSource,
    columns: doc.columns || [],
    filters: doc.filters || {},
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function createCustomReport(data: any): Promise<CustomReport> {
  const parsed = reportSchema.parse(data);
  const { db } = await connectToDatabase();
  const newDoc = {
    ...parsed,
    filters: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const res = await db.collection(collectionName).insertOne(newDoc);
  return {
    id: res.insertedId.toString(),
    ...parsed,
    filters: {},
    createdAt: newDoc.createdAt.toISOString(),
    updatedAt: newDoc.updatedAt.toISOString(),
  };
}

export async function deleteCustomReport(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
