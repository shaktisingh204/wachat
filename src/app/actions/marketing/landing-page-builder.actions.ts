'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  title: z.string().min(1), slug: z.string().min(1), htmlContent: z.string().optional(), isPublished: z.boolean().default(false), views: z.number().default(0), conversions: z.number().default(0)
});

export async function getLandingPages() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('landing_pages').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching LandingPages:', error);
    throw new Error('Failed to fetch landing pages');
  }
}

export async function getLandingPage(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('landing_pages').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching LandingPage:', error);
    return null;
  }
}

export async function createLandingPage(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('landing_pages').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/landing-page-builder');
    return { success: true };
  } catch (error) {
    console.error('Error creating LandingPage:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateLandingPage(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('landing_pages').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/landing-page-builder');
    return { success: true };
  } catch (error) {
    console.error('Error updating LandingPage:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteLandingPage(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('landing_pages').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/landing-page-builder');
    return { success: true };
  } catch (error) {
    console.error('Error deleting LandingPage:', error);
    return { success: false, error: 'Database error' };
  }
}
