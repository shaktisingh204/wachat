'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  userId: z.string().min(1), items: z.array(z.any()).default([]), totalAmount: z.number().min(0), recovered: z.boolean().default(false)
});

export async function getAbandonedCarts() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('abandoned_carts').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching AbandonedCarts:', error);
    return [];
  }
}

export async function getAbandonedCart(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('abandoned_carts').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching AbandonedCart:', error);
    return null;
  }
}

export async function createAbandonedCart(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('abandoned_carts').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/cart-abandonment');
    return { success: true };
  } catch (error) {
    console.error('Error creating AbandonedCart:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateAbandonedCart(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('abandoned_carts').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/cart-abandonment');
    return { success: true };
  } catch (error) {
    console.error('Error updating AbandonedCart:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteAbandonedCart(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('abandoned_carts').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/cart-abandonment');
    return { success: true };
  } catch (error) {
    console.error('Error deleting AbandonedCart:', error);
    return { success: false, error: 'Database error' };
  }
}
