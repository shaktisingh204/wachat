'use server';

import { voice_call_schema, type VoiceCallType } from './voice-call.schema';

import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function getVoiceCalls() {
  const { db } = await connectToDatabase();
  const data = await db.collection('crm_advanced_voice_call').find({}).sort({ createdAt: -1 }).toArray();
  return {
    success: true,
    data: data.map(d => ({ ...d, _id: d._id.toString() })) as VoiceCallType[],
  };
}

export async function createVoiceCall(data: any) {
  const parsed = voice_call_schema.parse(data);
  const { db } = await connectToDatabase();
  const doc = {
    ...parsed,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const result = await db.collection('crm_advanced_voice_call').insertOne(doc);
  return {
    success: true,
    data: { ...doc, _id: result.insertedId.toString() } as VoiceCallType,
  };
}

export async function updateVoiceCall(id: string, data: any) {
  const parsed = voice_call_schema.parse(data);
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_voice_call').updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...parsed, updatedAt: new Date() } }
  );
  return { success: true };
}

export async function deleteVoiceCall(id: string) {
  const { db } = await connectToDatabase();
  await db.collection('crm_advanced_voice_call').deleteOne({ _id: new ObjectId(id) });
  return { success: true };
}
