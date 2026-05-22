'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const competitor_tracking_schema = z.object({
  competitorName: z.string().min(1, "competitorName is required"),
  marketShare: z.coerce.number(),
  threatLevel: z.enum(['low', 'medium', 'high'])
});

export type CompetitorTrackingType = z.infer<typeof competitor_tracking_schema> & { _id: string; createdAt: Date; updatedAt: Date };

export async function getCompetitorTrackings() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_competitor_tracking').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as CompetitorTrackingType[],
  };
}

export async function createCompetitorTracking(data: any) {
  const parsed = competitor_tracking_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_competitor_tracking').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as CompetitorTrackingType,
  };
}

export async function updateCompetitorTracking(id: string, data: any) {
  const parsed = competitor_tracking_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_competitor_tracking').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteCompetitorTracking(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_competitor_tracking').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
