"use server";

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export interface Vendor {
  _id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  name?: string; contactEmail?: string; paymentTerms?: string; activeContracts?: number; onboardingStatus?: string;
}

const schema = z.object({
  name: z.string().min(1),
  contactEmail: z.string().email(),
  paymentTerms: z.string().optional().default('NET_30'),
  activeContracts: z.number().optional().default(0),
  onboardingStatus: z.string().optional().default('ACTIVE')
});

export async function listVendors(): Promise<{ items: Vendor[], error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    const docs = await db.collection('finance_vendors')
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

export async function createVendor(data: any) {
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
    
    const res = await db.collection('finance_vendors').insertOne(doc);
    return { success: true, id: res.insertedId.toString() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateVendor(id: string, data: any) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    
    await db.collection('finance_vendors').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(session.user._id)) },
      { $set: { ...parsed, updatedAt: new Date().toISOString() } }
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteVendor(id: string) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    await db.collection('finance_vendors').deleteOne({ 
      _id: new ObjectId(id), 
      userId: new ObjectId(String(session.user._id)) 
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
