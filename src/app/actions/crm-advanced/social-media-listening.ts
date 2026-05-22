'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const social_media_listening_schema = z.object({
  platform: z.string().min(1, "platform is required"),
  keyword: z.string().min(1, "keyword is required"),
  sentiment: z.enum(['positive', 'neutral', 'negative'])
});

export type SocialMediaListeningType = z.infer<typeof social_media_listening_schema> & { _id: string; createdAt: Date; updatedAt: Date };

export async function getSocialMediaListenings() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_social_media_listening').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as SocialMediaListeningType[],
  };
}

export async function createSocialMediaListening(data: any) {
  const parsed = social_media_listening_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_social_media_listening').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as SocialMediaListeningType,
  };
}

export async function updateSocialMediaListening(id: string, data: any) {
  const parsed = social_media_listening_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_social_media_listening').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteSocialMediaListening(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_social_media_listening').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
