"use server";

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

interface GlEntry {
  _id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  currency?: string; baseAmount?: number; exchangeRate?: number; accountId?: string; credit?: number; debit?: number; transactionDate?: string;
}

const schema = z.object({
  currency: z.string().min(1),
  baseAmount: z.number(),
  exchangeRate: z.number().optional().default(1),
  accountId: z.string().min(1),
  credit: z.number().optional().default(0),
  debit: z.number().optional().default(0),
  transactionDate: z.string().optional()
});

export async function listGlEntrys(): Promise<{ items: GlEntry[], error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    const docs = await db.collection('finance_gl_entries')
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

export async function createGlEntry(data: any) {
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
    
    const res = await db.collection('finance_gl_entries').insertOne(doc);
    return { success: true, id: res.insertedId.toString() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateGlEntry(id: string, data: any) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    
    await db.collection('finance_gl_entries').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(session.user._id)) },
      { $set: { ...parsed, updatedAt: new Date().toISOString() } }
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteGlEntry(id: string) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    await db.collection('finance_gl_entries').deleteOne({ 
      _id: new ObjectId(id), 
      userId: new ObjectId(String(session.user._id)) 
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
