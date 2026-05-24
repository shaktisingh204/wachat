'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  platform: z.enum(["facebook", "twitter", "instagram", "linkedin"]), 
  content: z.string().min(1), 
  scheduledTime: z.string().or(z.date()), 
  status: z.enum(["scheduled", "published", "failed"]),
  tags: z.array(z.string()).optional()
});

export async function getSocialPosts() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('social_posts').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching SocialPosts:', error);
    return [];
  }
}

export async function getSocialPost(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('social_posts').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching SocialPost:', error);
    return null;
  }
}

export async function createSocialPost(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('social_posts').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/social-media-scheduler');
    return { success: true };
  } catch (error) {
    console.error('Error creating SocialPost:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateSocialPost(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('social_posts').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/social-media-scheduler');
    return { success: true };
  } catch (error) {
    console.error('Error updating SocialPost:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteSocialPost(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('social_posts').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/social-media-scheduler');
    return { success: true };
  } catch (error) {
    console.error('Error deleting SocialPost:', error);
    return { success: false, error: 'Database error' };
  }
}

import { generateSocialPostOptimizations } from '@/ai/flows/generate-social-post-optimizations';

export async function suggestOptimizations(content: string, platform: string) {
  try {
    const result = await generateSocialPostOptimizations({ content, platform });
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error suggesting optimizations:', error);
    return { success: false, error: error.message || 'Failed to suggest optimizations' };
  }
}
