'use server';

import { customer_portal_schema, type CustomerPortalType } from './customer-portal.schema';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function getCustomerPortals() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_customer_portal').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as CustomerPortalType[],
  };
}

export async function createCustomerPortal(data: any) {
  const parsed = customer_portal_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_customer_portal').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as CustomerPortalType,
  };
}

export async function updateCustomerPortal(id: string, data: any) {
  const parsed = customer_portal_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_customer_portal').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteCustomerPortal(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_customer_portal').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
