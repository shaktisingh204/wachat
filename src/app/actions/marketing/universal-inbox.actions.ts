'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  channel: z.enum(["email", "whatsapp", "facebook", "instagram", "telegram"]), senderId: z.string().min(1), content: z.string().min(1), isRead: z.boolean().default(false)
});

export async function getInboxMessages() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('inbox_messages').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching InboxMessages:', error);
    return [];
  }
}

export async function getInboxMessage(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('inbox_messages').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching InboxMessage:', error);
    return null;
  }
}

export async function createInboxMessage(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('inbox_messages').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/universal-inbox');
    return { success: true };
  } catch (error) {
    console.error('Error creating InboxMessage:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateInboxMessage(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('inbox_messages').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/universal-inbox');
    return { success: true };
  } catch (error) {
    console.error('Error updating InboxMessage:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteInboxMessage(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('inbox_messages').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/universal-inbox');
    return { success: true };
  } catch (error) {
    console.error('Error deleting InboxMessage:', error);
    return { success: false, error: 'Database error' };
  }
}
