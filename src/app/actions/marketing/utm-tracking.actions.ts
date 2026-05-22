'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  url: z.string().url(), source: z.string().min(1), medium: z.string().min(1), campaign: z.string().min(1), term: z.string().optional(), content: z.string().optional(), clicks: z.number().default(0)
});

export async function getUtmLinks() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('utm_links').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching UtmLinks:', error);
    return [];
  }
}

export async function getUtmLink(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('utm_links').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching UtmLink:', error);
    return null;
  }
}

export async function createUtmLink(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('utm_links').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/utm-tracking');
    return { success: true };
  } catch (error) {
    console.error('Error creating UtmLink:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateUtmLink(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('utm_links').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/utm-tracking');
    return { success: true };
  } catch (error) {
    console.error('Error updating UtmLink:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteUtmLink(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('utm_links').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/utm-tracking');
    return { success: true };
  } catch (error) {
    console.error('Error deleting UtmLink:', error);
    return { success: false, error: 'Database error' };
  }
}
