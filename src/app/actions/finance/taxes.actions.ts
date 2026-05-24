"use server";

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

export interface TaxRecord {
  _id?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  taxPeriod?: string; jurisdiction?: string; taxableIncome?: number; taxOwed?: number; isFiled?: boolean;
}

const schema = z.object({
  taxPeriod: z.string().min(1),
  jurisdiction: z.string().min(1),
  taxableIncome: z.number(),
  taxOwed: z.number(),
  isFiled: z.boolean().optional().default(false)
});

export async function listTaxRecords(filters?: { period?: string }): Promise<{ items: TaxRecord[], error?: string }> {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    const query: any = { userId: new ObjectId(String(session.user._id)) };
    if (filters?.period) {
      query.taxPeriod = { $regex: filters.period, $options: 'i' };
    }
    const docs = await db.collection('finance_taxes')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
      
    return { 
      items: docs.map(d => ({ ...d, _id: d._id.toString(), userId: d.userId.toString() })) as any
    };
  } catch (error: any) {
    return { items: [], error: error.message };
  }
}

export async function exportTaxRecordsCSV(filters?: { period?: string }): Promise<{ csv?: string, error?: string }> {
  try {
    const { items, error } = await listTaxRecords(filters);
    if (error) throw new Error(error);

    const headers = ['Tax Period', 'Jurisdiction', 'Taxable Income', 'Tax Owed', 'Is Filed', 'Created At'];
    const rows = items.map(item => [
      item.taxPeriod,
      item.jurisdiction,
      item.taxableIncome,
      item.taxOwed,
      item.isFiled ? 'Yes' : 'No',
      item.createdAt
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return { csv: csvContent };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function createTaxRecord(data: any) {
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
    
    const res = await db.collection('finance_taxes').insertOne(doc);
    return { success: true, id: res.insertedId.toString() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateTaxRecord(id: string, data: any) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const parsed = schema.partial().parse(data);
    const { db } = await connectToDatabase();
    
    await db.collection('finance_taxes').updateOne(
      { _id: new ObjectId(id), userId: new ObjectId(String(session.user._id)) },
      { $set: { ...parsed, updatedAt: new Date().toISOString() } }
    );
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteTaxRecord(id: string) {
  try {
    const session = await getSession();
    if (!session?.user?._id) throw new Error("Unauthorized");
    
    const { db } = await connectToDatabase();
    await db.collection('finance_taxes').deleteOne({ 
      _id: new ObjectId(id), 
      userId: new ObjectId(String(session.user._id)) 
    });
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
