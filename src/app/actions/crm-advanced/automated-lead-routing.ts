'use server';

import { automated_lead_routing_schema, type AutomatedLeadRoutingType } from './automated-lead-routing.schema';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function getAutomatedLeadRoutings() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_automated_lead_routing').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as AutomatedLeadRoutingType[],
  };
}

export async function createAutomatedLeadRouting(data: any) {
  const parsed = automated_lead_routing_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_automated_lead_routing').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as AutomatedLeadRoutingType,
  };
}

export async function updateAutomatedLeadRouting(id: string, data: any) {
  const parsed = automated_lead_routing_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_automated_lead_routing').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteAutomatedLeadRouting(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_automated_lead_routing').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
