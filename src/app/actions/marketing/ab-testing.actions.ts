'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  experimentName: z.string().min(1), variants: z.array(z.string()).default([]), winningVariantId: z.string().optional(), status: z.enum(["running", "completed", "draft"])
});

export async function getAbTests() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('ab_tests').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching AbTests:', error);
    return [];
  }
}

export async function getAbTest(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('ab_tests').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching AbTest:', error);
    return null;
  }
}

export async function createAbTest(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('ab_tests').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/sabsense/ab-testing');
    return { success: true };
  } catch (error) {
    console.error('Error creating AbTest:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateAbTest(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('ab_tests').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/sabsense/ab-testing');
    return { success: true };
  } catch (error) {
    console.error('Error updating AbTest:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteAbTest(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('ab_tests').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/sabsense/ab-testing');
    return { success: true };
  } catch (error) {
    console.error('Error deleting AbTest:', error);
    return { success: false, error: 'Database error' };
  }
}
