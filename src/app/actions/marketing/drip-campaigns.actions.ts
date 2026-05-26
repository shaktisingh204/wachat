'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1), status: z.enum(["draft", "active", "paused", "completed"]), audienceId: z.string().min(1)
});

export async function getDripCampaigns() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('drip_campaigns').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching DripCampaigns:', error);
    throw new Error('Failed to fetch DripCampaigns');
  }
}

export async function getDripCampaign(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('drip_campaigns').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching DripCampaign:', error);
    return null;
  }
}

export async function createDripCampaign(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('drip_campaigns').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/sabcampaigns');
    return { success: true };
  } catch (error) {
    console.error('Error creating DripCampaign:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateDripCampaign(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('drip_campaigns').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/sabcampaigns');
    return { success: true };
  } catch (error) {
    console.error('Error updating DripCampaign:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteDripCampaign(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('drip_campaigns').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/sabcampaigns');
    return { success: true };
  } catch (error) {
    console.error('Error deleting DripCampaign:', error);
    return { success: false, error: 'Database error' };
  }
}
