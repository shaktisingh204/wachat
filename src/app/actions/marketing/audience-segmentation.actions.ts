'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1), rules: z.array(z.any()).default([]), contactCount: z.number().default(0)
});

export async function getAudienceSegments() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('audience_segments').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching AudienceSegments:', error);
    return [];
  }
}

export async function getAudienceSegment(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('audience_segments').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching AudienceSegment:', error);
    return null;
  }
}

export async function createAudienceSegment(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('audience_segments').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/audience-segmentation');
    return { success: true };
  } catch (error) {
    console.error('Error creating AudienceSegment:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateAudienceSegment(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('audience_segments').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/audience-segmentation');
    return { success: true };
  } catch (error) {
    console.error('Error updating AudienceSegment:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteAudienceSegment(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('audience_segments').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/audience-segmentation');
    return { success: true };
  } catch (error) {
    console.error('Error deleting AudienceSegment:', error);
    return { success: false, error: 'Database error' };
  }
}
