'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const customer_portal_schema = z.object({
  customerId: z.string().min(1, "customerId is required"),
  portalUrl: z.string().min(1, "portalUrl is required"),
  status: z.enum(['active', 'suspended'])
});

export type CustomerPortalType = z.infer<typeof customer_portal_schema> & { _id: string; createdAt: Date; updatedAt: Date };

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
