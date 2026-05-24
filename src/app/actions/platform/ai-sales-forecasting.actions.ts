'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { AISalesForecast } from '@/types/platform';

const collectionName = 'platform_ai_sales_forecasts';

const forecastSchema = z.object({
  period: z.string(),
  predictedRevenue: z.number(),
  confidenceScore: z.number(),
  aiModel: z.string().optional(),
  drivers: z.array(z.string()),
});

export async function getSalesForecasts(): Promise<AISalesForecast[]> {
  const { db } = await connectToDatabase();
  const docs = await db.collection(collectionName).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(doc => ({
    id: doc._id.toString(),
    period: doc.period,
    predictedRevenue: doc.predictedRevenue,
    confidenceScore: doc.confidenceScore,
    aiModel: doc.aiModel,
    drivers: doc.drivers || [],
    createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

export async function createSalesForecast(data: any): Promise<AISalesForecast> {
  const parsed = forecastSchema.parse(data);
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

export async function deleteSalesForecast(id: string): Promise<boolean> {
  const { db } = await connectToDatabase();
  const res = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
  return res.deletedCount === 1;
}
