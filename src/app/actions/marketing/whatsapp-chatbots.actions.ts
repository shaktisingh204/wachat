'use server';

import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1), phoneNumber: z.string().min(1), isActive: z.boolean().default(false)
});

export async function getWhatsappBots() {
  try {
    const { db } = await connectToDatabase();
    const records = await db.collection('whatsapp_bots').find({}).sort({ createdAt: -1 }).toArray();
    return records.map(r => ({ ...r, _id: r._id.toString() }));
  } catch (error) {
    console.error('Error fetching WhatsappBots:', error);
    return [];
  }
}

export async function getWhatsappBot(id: string) {
  try {
    const { db } = await connectToDatabase();
    const record = await db.collection('whatsapp_bots').findOne({ _id: new ObjectId(id) });
    if (!record) return null;
    return { ...record, _id: record._id.toString() };
  } catch (error) {
    console.error('Error fetching WhatsappBot:', error);
    return null;
  }
}

export async function createWhatsappBot(data: any) {
  try {
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    await db.collection('whatsapp_bots').insertOne({
      ...parsed,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath('/dashboard/marketing/whatsapp-chatbots');
    return { success: true };
  } catch (error) {
    console.error('Error creating WhatsappBot:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function updateWhatsappBot(id: string, data: any) {
  try {
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    await db.collection('whatsapp_bots').updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...parsed, updatedAt: new Date() } }
    );
    revalidatePath('/dashboard/marketing/whatsapp-chatbots');
    return { success: true };
  } catch (error) {
    console.error('Error updating WhatsappBot:', error);
    return { success: false, error: 'Validation or database error' };
  }
}

export async function deleteWhatsappBot(id: string) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('whatsapp_bots').deleteOne({ _id: new ObjectId(id) });
    revalidatePath('/dashboard/marketing/whatsapp-chatbots');
    return { success: true };
  } catch (error) {
    console.error('Error deleting WhatsappBot:', error);
    return { success: false, error: 'Database error' };
  }
}
