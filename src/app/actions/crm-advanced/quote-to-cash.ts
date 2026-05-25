'use server';

import { quote_to_cash_schema, type QuoteToCashType } from './quote-to-cash.schema';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

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
