'use server';

import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const sla_escalation_schema = z.object({
  ticketId: z.string().min(1, "ticketId is required"),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  escalatedTo: z.string().min(1, "escalatedTo is required")
});

export type SlaEscalationType = z.infer<typeof sla_escalation_schema> & { _id: string; createdAt: Date; updatedAt: Date };

export async function getSlaEscalations() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_sla_escalation').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as SlaEscalationType[],
  };
}

export async function createSlaEscalation(data: any) {
  const parsed = sla_escalation_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_sla_escalation').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as SlaEscalationType,
  };
}

export async function updateSlaEscalation(id: string, data: any) {
  const parsed = sla_escalation_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_sla_escalation').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteSlaEscalation(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_sla_escalation').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
