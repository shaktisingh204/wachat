'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1), code: z.string().min(1), commissionRate: z.number().min(0), earnings: z.number().default(0)
});

export async function getAffiliates() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('affiliates').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching Affiliates:', error);
    return [];
  }
}

export async function getAffiliate(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('affiliates').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching Affiliate:', error);
    return null;
  }
}

export async function createAffiliate(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('affiliates').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/affiliate-management');
    return { success: true };
  } catch (error) {
    console.error('Error creating Affiliate:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateAffiliate(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('affiliates').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/affiliate-management');
    return { success: true };
  } catch (error) {
    console.error('Error updating Affiliate:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteAffiliate(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('affiliates').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/affiliate-management');
    return { success: true };
  } catch (error) {
    console.error('Error deleting Affiliate:', error);
    return { success: false, error: 'Database error' };
  }
}
