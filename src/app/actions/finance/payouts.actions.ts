"use server";

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export interface Payout {
  _id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  recipientId?: string; recipientType?: 'EMPLOYEE'|'VENDOR'; amount?: number; paymentMethod?: string; executionDate?: string; status?: string;
}

const schema = z.object({
  recipientId: z.string().min(1),
  recipientType: z.enum(['EMPLOYEE', 'VENDOR']),
  amount: z.number(),
  paymentMethod: z.string().optional().default('BANK_TRANSFER'),
  executionDate: z.string().optional(),
  status: z.string().optional().default('PENDING')
});

export async function listPayouts(): Promise<{ items: Payout[], error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    const docs = await db.collection('finance_payouts')
      .find({ userId: new ObjectId(String(session.user._id)) })
      .sort({ createdAt: -1 })
      .toArray();
      
    return { 
      items: docs.map(d => ({ ...d, _id: d._id.toString(), userId: d.userId.toString() })) as any
    };
  } catch (error: any) {
    return { items: [], error: error.message };
  }
}

export async function createPayout(data: any) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const parsed = schema.parse(data);
    const { db } = await connectToDatabase();
    
    const doc = {
      ...parsed,
      userId: new ObjectId(String(session.user._id)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const res = await db.collection('finance_payouts').insertOne(doc);
    return { success: true, id: res.insertedId.toString() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updatePayout(id: string, data: any) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    
    await db.collection('finance_payouts').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(session.user._id)) },
      { $set: { ...parsed, updatedAt: new Date().toISOString() } }
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deletePayout(id: string) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    await db.collection('finance_payouts').deleteOne({ 
      _id: new ObjectId(id), 
      userId: new ObjectId(String(session.user._id)) 
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
