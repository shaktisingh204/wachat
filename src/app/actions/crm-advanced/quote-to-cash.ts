'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const quote_to_cash_schema = z.object({
  quoteId: z.string().min(1, "quoteId is required"),
  amount: z.coerce.number(),
  status: z.enum(['draft', 'sent', 'paid'])
});

export type QuoteToCashType = z.infer<typeof quote_to_cash_schema> & { _id: string; createdAt: Date; updatedAt: Date };

export async function getQuoteToCashs() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_quote_to_cash').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as QuoteToCashType[],
  };
}

export async function createQuoteToCash(data: any) {
  const parsed = quote_to_cash_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_quote_to_cash').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as QuoteToCashType,
  };
}

export async function updateQuoteToCash(id: string, data: any) {
  const parsed = quote_to_cash_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_quote_to_cash').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteQuoteToCash(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_quote_to_cash').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
